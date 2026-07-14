import { productRepository } from "./products.repository.js";
import { stockRepository } from "../Stock/stock.repository.js";
import { categoryRepository } from "../Categories/categories.repository.js";
import { supplierRepository } from "../Suppliers/suppliers.repository.js";
import { getPagination, buildPaginationResult } from "../../utils/pagination.js";
import { createActivityLog } from "../ActivityLog/activityLog.service.js";
import { ACTIVITY_ACTIONS, ACTIVITY_ENTITIES, ROLES } from "../../constants/enums.js";
import { MSG } from "../../constants/messages.ar.js";
import { runInTransaction } from "../../utils/transaction.js";
import { deleteUploadedFiles } from "../../utils/multer.js";

export const createProduct = async (payload, imageData, userId) => {
  const category = await categoryRepository.findById(payload.categoryId);
  if (!category || !category.isActive) {
    const error = new Error(MSG.CATEGORY_INACTIVE);
    error.cause = 400;
    throw error;
  }

  const supplier = await supplierRepository.findById(payload.supplierId);
  if (!supplier) {
    const error = new Error(MSG.SUPPLIER_NOT_FOUND);
    error.cause = 400;
    throw error;
  }

  const existingSku = await productRepository.findBySku(payload.sku);
  if (existingSku) {
    const error = new Error(MSG.SKU_EXISTS);
    error.cause = 400;
    throw error;
  }

  if (payload.barcode) {
    const existingBarcode = await productRepository.findByBarcode(payload.barcode);
    if (existingBarcode) {
      const error = new Error(MSG.BARCODE_EXISTS);
      error.cause = 400;
      throw error;
    }
  }

  const productId = await runInTransaction(async (session) => {
    const product = await productRepository.create(
      {
        sku: payload.sku,
        barcode: payload.barcode?.trim() ? payload.barcode.trim() : undefined,
        name: payload.name,
        description: payload.description || "",
        categoryId: payload.categoryId,
        supplierId: payload.supplierId,
        costPrice: payload.costPrice,
        sellingPrice: payload.sellingPrice,
        image: imageData?.path || "",
        imageLqip: imageData?.lqip || "",
        createdBy: userId,
        updatedBy: userId,
      },
      session
    );

    await stockRepository.create(
      {
        productId: product._id,
        quantity: Number(payload.initialQuantity) || 0,
        minimumQuantity: Number(payload.minimumQuantity) || 0,
        lastUpdated: new Date(),
      },
      session
    );

    await createActivityLog(
      {
        user: userId,
        action: ACTIVITY_ACTIONS.CREATED_PRODUCT,
        entity: ACTIVITY_ENTITIES.PRODUCT,
        entityId: product._id,
        description: MSG.LOG_CREATED_PRODUCT(product.name, product.sku),
      },
      session
    );

    return product._id;
  });

  return productRepository.findById(productId);
};

export const listProducts = async (query, user) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};

  const isAdmin = user?.role === ROLES.ADMIN;

  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === "true";
  } else if (!isAdmin) {
    // Cashiers only see active products; Admin gets all by default
    filter.isActive = true;
  }

  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: "i" } },
      { sku: { $regex: query.search, $options: "i" } },
      { barcode: { $regex: query.search, $options: "i" } },
    ];
  }

  if (query.categoryId) filter.categoryId = query.categoryId;
  if (query.supplierId) filter.supplierId = query.supplierId;

  const { items, total } = await productRepository.findPaginated({ skip, limit, filter });
  return buildPaginationResult(items, total, page, limit);
};

export const getProductById = async (id) => {
  const product = await productRepository.findById(id);
  if (!product) {
    const error = new Error(MSG.PRODUCT_NOT_FOUND);
    error.cause = 404;
    throw error;
  }

  const stock = await stockRepository.findByProductId(id);
  return { product, stock };
};

export const updateProduct = async (id, payload, imageData, userId) => {
  const existing = await productRepository.findByIdLean(id);
  if (!existing) {
    const error = new Error(MSG.PRODUCT_NOT_FOUND);
    error.cause = 404;
    throw error;
  }

  if (payload.categoryId) {
    const category = await categoryRepository.findById(payload.categoryId);
    if (!category || !category.isActive) {
      const error = new Error(MSG.CATEGORY_INACTIVE);
      error.cause = 400;
      throw error;
    }
  }

  if (payload.supplierId) {
    const supplier = await supplierRepository.findById(payload.supplierId);
    if (!supplier) {
      const error = new Error(MSG.SUPPLIER_NOT_FOUND);
      error.cause = 400;
      throw error;
    }
  }

  if (payload.sku && payload.sku !== existing.sku) {
    const existingSku = await productRepository.findBySku(payload.sku);
    if (existingSku) {
      const error = new Error(MSG.SKU_EXISTS);
      error.cause = 400;
      throw error;
    }
  }

  if (payload.barcode && payload.barcode !== existing.barcode) {
    const existingBarcode = await productRepository.findByBarcode(payload.barcode);
    if (existingBarcode) {
      const error = new Error(MSG.BARCODE_EXISTS);
      error.cause = 400;
      throw error;
    }
  }

  const updateData = {
    ...payload,
    updatedBy: userId,
  };

  const oldImage = existing.image;
  const oldImageLqip = existing.imageLqip;
  const hasNewImage = Boolean(imageData?.path);

  if (hasNewImage) {
    updateData.image = imageData.path;
    updateData.imageLqip = imageData.lqip || "";
  }

  delete updateData.initialQuantity;
  delete updateData.minimumQuantity;

  const product = await productRepository.updateById(id, updateData);

  // Delete old files after DB update; never delete the newly uploaded paths
  if (hasNewImage) {
    const filesToDelete = [oldImage, oldImageLqip].filter(
      (p) => p && p !== imageData.path && p !== imageData.lqip
    );
    await deleteUploadedFiles(...filesToDelete);
  }

  if (payload.minimumQuantity !== undefined) {
    await stockRepository.updateByProductId(id, {
      minimumQuantity: Number(payload.minimumQuantity),
      lastUpdated: new Date(),
    });
  }

  await createActivityLog({
    user: userId,
    action: ACTIVITY_ACTIONS.UPDATED_PRODUCT,
    entity: ACTIVITY_ENTITIES.PRODUCT,
    entityId: product._id,
    description: MSG.LOG_UPDATED_PRODUCT(product.name, product.sku),
  });

  return product;
};

export const deactivateProduct = async (id, userId) => {
  const product = await productRepository.updateById(id, {
    isActive: false,
    updatedBy: userId,
  });

  if (!product) {
    const error = new Error(MSG.PRODUCT_NOT_FOUND);
    error.cause = 404;
    throw error;
  }

  await createActivityLog({
    user: userId,
    action: ACTIVITY_ACTIONS.UPDATED_PRODUCT,
    entity: ACTIVITY_ENTITIES.PRODUCT,
    entityId: product._id,
    description: MSG.LOG_DEACTIVATED_PRODUCT(product.name, product.sku),
  });

  return product;
};

export const restoreProduct = async (id, userId) => {
  const existing = await productRepository.findByIdLean(id);
  if (!existing) {
    const error = new Error(MSG.PRODUCT_NOT_FOUND);
    error.cause = 404;
    throw error;
  }

  if (existing.isActive) {
    const error = new Error(MSG.PRODUCT_ALREADY_ACTIVE);
    error.cause = 400;
    throw error;
  }

  const product = await productRepository.updateById(id, {
    isActive: true,
    updatedBy: userId,
  });

  await createActivityLog({
    user: userId,
    action: ACTIVITY_ACTIONS.UPDATED_PRODUCT,
    entity: ACTIVITY_ENTITIES.PRODUCT,
    entityId: product._id,
    description: MSG.LOG_RESTORED_PRODUCT(product.name, product.sku),
  });

  return product;
};
