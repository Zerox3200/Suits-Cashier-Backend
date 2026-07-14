import { stockRepository } from "./stock.repository.js";
import { stockMovementRepository } from "../StockMovements/stockMovements.repository.js";
import { productRepository } from "../Products/products.repository.js";
import { getPagination, buildPaginationResult } from "../../utils/pagination.js";
import { createActivityLog } from "../ActivityLog/activityLog.service.js";
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITIES,
  STOCK_ADJUST_REASON,
  STOCK_MOVEMENT_TYPE,
  STOCK_MOVEMENT_REASON,
  STOCK_REFERENCE_TYPE,
} from "../../constants/enums.js";
import { MSG } from "../../constants/messages.ar.js";
import { runInTransaction } from "../../utils/transaction.js";

const resolveMovementType = (reason, currentQty, newQty) => {
  if (reason === STOCK_ADJUST_REASON.PURCHASE) {
    return STOCK_MOVEMENT_TYPE.IN;
  }
  if (
    reason === STOCK_ADJUST_REASON.DAMAGED ||
    reason === STOCK_ADJUST_REASON.LOST
  ) {
    return STOCK_MOVEMENT_TYPE.OUT;
  }
  return newQty >= currentQty ? STOCK_MOVEMENT_TYPE.IN : STOCK_MOVEMENT_TYPE.OUT;
};

const resolveReferenceType = (reason) => {
  if (reason === STOCK_ADJUST_REASON.PURCHASE) {
    return STOCK_REFERENCE_TYPE.PURCHASE;
  }
  if (reason === STOCK_ADJUST_REASON.MANUAL) {
    return STOCK_REFERENCE_TYPE.MANUAL;
  }
  return STOCK_REFERENCE_TYPE.ADJUSTMENT;
};

export const listStock = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.productId) filter.productId = query.productId;
  const { items, total } = await stockRepository.findPaginated({ skip, limit, filter });
  return buildPaginationResult(items, total, page, limit);
};

export const getStockByProductId = async (productId) => {
  const stock = await stockRepository.findByProductId(productId);
  if (!stock) {
    const error = new Error(MSG.STOCK_NOT_FOUND);
    error.cause = 404;
    throw error;
  }
  return stock.populate({
    path: "productId",
    populate: [
      { path: "categoryId", select: "name" },
      { path: "supplierId", select: "name" },
    ],
  });
};

export const adjustStock = async (productId, { quantity, reason }, userId) => {
  const product = await productRepository.findByIdLean(productId);
  if (!product) {
    const error = new Error(MSG.PRODUCT_NOT_FOUND);
    error.cause = 404;
    throw error;
  }

  const stock = await stockRepository.findByProductId(productId);
  if (!stock) {
    const error = new Error(MSG.STOCK_RECORD_NOT_FOUND);
    error.cause = 404;
    throw error;
  }

  const newQuantity = Number(quantity);
  if (Number.isNaN(newQuantity) || newQuantity < 0) {
    const error = new Error(MSG.QUANTITY_NON_NEGATIVE);
    error.cause = 400;
    throw error;
  }

  const delta = Math.abs(newQuantity - stock.quantity);
  if (delta === 0) {
    const error = new Error(MSG.QUANTITY_UNCHANGED);
    error.cause = 400;
    throw error;
  }

  const type = resolveMovementType(reason, stock.quantity, newQuantity);

  // Damaged/Lost/Purchase semantics: quantity is the absolute new stock level for Correction/Manual;
  // For Damaged/Lost we treat body.quantity as the absolute target as well (set stock to this value).
  const movementReason =
    reason === STOCK_ADJUST_REASON.RETURN
      ? STOCK_MOVEMENT_REASON.RETURN
      : reason;

  return runInTransaction(async (session) => {
    const updated = await stockRepository.updateByProductId(
      productId,
      { quantity: newQuantity, lastUpdated: new Date() },
      session
    );

    await stockMovementRepository.create(
      {
        productId,
        quantity: delta,
        type,
        reason: movementReason,
        referenceId: null,
        referenceType: resolveReferenceType(reason),
        createdBy: userId,
      },
      session
    );

    await createActivityLog(
      {
        user: userId,
        action: ACTIVITY_ACTIONS.ADJUSTED_STOCK,
        entity: ACTIVITY_ENTITIES.STOCK,
        entityId: updated._id,
        description: MSG.LOG_ADJUSTED_STOCK(product.sku, newQuantity, reason),
      },
      session
    );

    return updated;
  });
};

export const listLowStock = async () => {
  return stockRepository.findLowStock();
};
