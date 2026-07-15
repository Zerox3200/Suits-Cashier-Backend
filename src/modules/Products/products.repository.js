import mongoose from "mongoose";
import { Product } from "../../../DB/Products/Products.model.js";

const populateFields = [
  { path: "categoryId", select: "name description isActive" },
  { path: "supplierId", select: "name phone address isActive" },
];

export const productRepository = {
  create: (data, session = null) => {
    if (session) {
      return Product.create([data], { session }).then((docs) => docs[0]);
    }
    return Product.create(data);
  },

  findById: (id) => Product.findById(id).populate(populateFields),

  findByIdLean: (id, session = null) => {
    const q = Product.findById(id);
    if (session) q.session(session);
    return q;
  },

  findBySku: (sku) => {
    const normalized = String(sku || "").trim().toUpperCase();
    return Product.findOne({ sku: normalized });
  },

  findByBarcode: (barcode) => Product.findOne({ barcode }),

  /** Lookup by barcode, SKU, or product id (QR/barcode scanner payload). */
  findByScanCode: async (code) => {
    const trimmed = String(code || "").trim();
    if (!trimmed) return null;

    const byBarcode = await Product.findOne({ barcode: trimmed }).populate(
      populateFields
    );
    if (byBarcode) return byBarcode;

    const bySku = await Product.findOne({
      sku: trimmed.toUpperCase(),
    }).populate(populateFields);
    if (bySku) return bySku;

    if (mongoose.Types.ObjectId.isValid(trimmed)) {
      return Product.findById(trimmed).populate(populateFields);
    }

    return null;
  },

  findManyByIds: (ids, session = null) => {
    const q = Product.find({ _id: { $in: ids }, isActive: true });
    if (session) q.session(session);
    return q;
  },

  findPaginated: async ({ skip, limit, filter = {} }) => {
    const [items, total] = await Promise.all([
      Product.find(filter)
        .populate(populateFields)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Product.countDocuments(filter),
    ]);
    return { items, total };
  },

  updateById: (id, data) => {
    const update = { ...data };

    // Empty barcode must be unset — unique index treats "" as a duplicate key
    if (
      Object.prototype.hasOwnProperty.call(update, "barcode") &&
      (update.barcode === "" ||
        update.barcode === null ||
        (typeof update.barcode === "string" && !update.barcode.trim()))
    ) {
      delete update.barcode;
      return Product.findByIdAndUpdate(
        id,
        { $set: update, $unset: { barcode: 1 } },
        { new: true, runValidators: true }
      ).populate(populateFields);
    }

    return Product.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).populate(populateFields);
  },

  softDeleteByCategoryId: (categoryId, updatedBy = null) =>
    Product.updateMany(
      { categoryId, isActive: true },
      {
        isActive: false,
        ...(updatedBy ? { updatedBy } : {}),
      }
    ),

  softRestoreByCategoryId: (categoryId, updatedBy = null) =>
    Product.updateMany(
      { categoryId, isActive: false },
      {
        isActive: true,
        ...(updatedBy ? { updatedBy } : {}),
      }
    ),

  count: (filter = {}) => Product.countDocuments(filter),
};
