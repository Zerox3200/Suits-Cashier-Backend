import mongoose from "mongoose";
import { invoiceRepository } from "./invoices.repository.js";
import { productRepository } from "../Products/products.repository.js";
import { stockRepository } from "../Stock/stock.repository.js";
import { stockMovementRepository } from "../StockMovements/stockMovements.repository.js";
import { generateInvoiceNumber } from "../../utils/invoiceNumber.js";
import { getPagination, buildPaginationResult } from "../../utils/pagination.js";
import { createActivityLog } from "../ActivityLog/activityLog.service.js";
import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITIES,
  INVOICE_STATUS,
  ROLES,
  STOCK_MOVEMENT_TYPE,
  STOCK_MOVEMENT_REASON,
  STOCK_REFERENCE_TYPE,
} from "../../constants/enums.js";
import { MSG } from "../../constants/messages.ar.js";
import { runInTransaction } from "../../utils/transaction.js";

const createUniqueInvoiceNumber = async (session) => {
  for (let attempt = 0; attempt < 10; attempt++) {
    const invoiceNumber = generateInvoiceNumber();
    const query = mongoose.model("Invoice").findOne({ invoiceNumber });
    if (session) query.session(session);
    const exists = await query;
    if (!exists) return invoiceNumber;
  }
  const error = new Error(MSG.INVOICE_NUMBER_FAILED);
  error.cause = 500;
  throw error;
};

export const createInvoice = async (payload, userId) => {
  if (!payload.items?.length) {
    const error = new Error(MSG.INVOICE_NEEDS_ITEMS);
    error.cause = 400;
    throw error;
  }

  const qtyByProduct = new Map();
  for (const item of payload.items) {
    const key = item.productId.toString();
    qtyByProduct.set(key, (qtyByProduct.get(key) || 0) + Number(item.quantity));
  }
  const mergedItems = [...qtyByProduct.entries()].map(([productId, quantity]) => ({
    productId,
    quantity,
  }));

  const invoiceId = await runInTransaction(async (session) => {
    const productIds = mergedItems.map((i) => i.productId);
    const products = await productRepository.findManyByIds(productIds, session);
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    const stocks = await stockRepository.findManyByProductIds(productIds, session);
    const stockMap = new Map(stocks.map((s) => [s.productId.toString(), s]));

    const snapshotItems = [];
    let subTotal = 0;

    for (const item of mergedItems) {
      const product = productMap.get(item.productId.toString());
      if (!product) {
        const error = new Error(MSG.PRODUCT_NOT_FOUND_ID(item.productId));
        error.cause = 400;
        throw error;
      }

      const stock = stockMap.get(item.productId.toString());
      if (!stock || stock.quantity < item.quantity) {
        const error = new Error(
          MSG.INSUFFICIENT_STOCK(product.name, stock?.quantity ?? 0)
        );
        error.cause = 400;
        throw error;
      }

      const lineTotal = product.sellingPrice * item.quantity;
      subTotal += lineTotal;

      snapshotItems.push({
        productId: product._id,
        sku: product.sku,
        barcode: product.barcode || "",
        name: product.name,
        quantity: item.quantity,
        unitPrice: product.sellingPrice,
        unitCost: product.costPrice,
        lineTotal,
      });
    }

    const discount = Number(payload.discount) || 0;
    const tax = Number(payload.tax) || 0;
    if (discount > subTotal) {
      const error = new Error(MSG.DISCOUNT_EXCEEDS);
      error.cause = 400;
      throw error;
    }

    const total = subTotal - discount + tax;
    const invoiceNumber = await createUniqueInvoiceNumber(session);

    const invoice = await invoiceRepository.create(
      {
        invoiceNumber,
        customerName: payload.customerName || "",
        customerPhone: payload.customerPhone || "",
        items: snapshotItems,
        subTotal,
        discount,
        tax,
        total,
        paymentMethod: payload.paymentMethod,
        notes: payload.notes || "",
        status: INVOICE_STATUS.COMPLETED,
        createdBy: userId,
      },
      session
    );

    for (const item of snapshotItems) {
      const stock = stockMap.get(item.productId.toString());
      await stockRepository.updateByProductId(
        item.productId,
        {
          quantity: stock.quantity - item.quantity,
          lastUpdated: new Date(),
        },
        session
      );
      stock.quantity -= item.quantity;

      await stockMovementRepository.create(
        {
          productId: item.productId,
          quantity: item.quantity,
          type: STOCK_MOVEMENT_TYPE.OUT,
          reason: STOCK_MOVEMENT_REASON.INVOICE,
          referenceId: invoice._id,
          referenceType: STOCK_REFERENCE_TYPE.INVOICE,
          createdBy: userId,
        },
        session
      );
    }

    await createActivityLog(
      {
        user: userId,
        action: ACTIVITY_ACTIONS.CREATED_INVOICE,
        entity: ACTIVITY_ENTITIES.INVOICE,
        entityId: invoice._id,
        description: MSG.LOG_CREATED_INVOICE(invoice.invoiceNumber),
      },
      session
    );

    return invoice._id;
  });

  return invoiceRepository.findById(invoiceId);
};

export const listInvoices = async (query, user) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};

  if (user.role === ROLES.CASHIER) {
    filter.createdBy = user._id;
  }

  if (query.status) filter.status = query.status;
  if (query.paymentMethod) filter.paymentMethod = query.paymentMethod;

  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }

  const { items, total } = await invoiceRepository.findPaginated({ skip, limit, filter });
  return buildPaginationResult(items, total, page, limit);
};

export const getInvoiceById = async (id) => {
  const invoice = await invoiceRepository.findById(id);
  if (!invoice) {
    const error = new Error(MSG.INVOICE_NOT_FOUND);
    error.cause = 404;
    throw error;
  }
  return invoice;
};

export const getInvoiceByNumber = async (invoiceNumber) => {
  const invoice = await invoiceRepository.findByNumber(invoiceNumber);
  if (!invoice) {
    const error = new Error(MSG.INVOICE_NOT_FOUND);
    error.cause = 404;
    throw error;
  }
  return invoice;
};

export const returnInvoice = async (id, { returnReason }, userId) => {
  const updatedId = await runInTransaction(async (session) => {
    const query = mongoose.model("Invoice").findById(id);
    if (session) query.session(session);
    const invoice = await query;

    if (!invoice) {
      const error = new Error(MSG.INVOICE_NOT_FOUND);
      error.cause = 404;
      throw error;
    }

    if (invoice.status === INVOICE_STATUS.RETURNED) {
      const error = new Error(MSG.INVOICE_ALREADY_RETURNED);
      error.cause = 400;
      throw error;
    }

    for (const item of invoice.items) {
      const stock = await stockRepository.findByProductId(item.productId, session);
      if (!stock) {
        const error = new Error(MSG.STOCK_NOT_FOUND_FOR_PRODUCT(item.sku));
        error.cause = 400;
        throw error;
      }

      await stockRepository.updateByProductId(
        item.productId,
        {
          quantity: stock.quantity + item.quantity,
          lastUpdated: new Date(),
        },
        session
      );

      await stockMovementRepository.create(
        {
          productId: item.productId,
          quantity: item.quantity,
          type: STOCK_MOVEMENT_TYPE.IN,
          reason: STOCK_MOVEMENT_REASON.RETURN,
          referenceId: invoice._id,
          referenceType: STOCK_REFERENCE_TYPE.INVOICE,
          createdBy: userId,
        },
        session
      );
    }

    const updated = await invoiceRepository.updateById(
      id,
      {
        status: INVOICE_STATUS.RETURNED,
        returnedAt: new Date(),
        returnedBy: userId,
        returnReason: returnReason || "",
      },
      session
    );

    await createActivityLog(
      {
        user: userId,
        action: ACTIVITY_ACTIONS.RETURNED_INVOICE,
        entity: ACTIVITY_ENTITIES.INVOICE,
        entityId: invoice._id,
        description: MSG.LOG_RETURNED_INVOICE(invoice.invoiceNumber, returnReason),
      },
      session
    );

    return updated._id;
  });

  return invoiceRepository.findById(updatedId);
};
