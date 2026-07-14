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

  findBySku: (sku) => Product.findOne({ sku }),

  findByBarcode: (barcode) => Product.findOne({ barcode }),

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

  updateById: (id, data) =>
    Product.findByIdAndUpdate(id, data, { new: true, runValidators: true }).populate(
      populateFields
    ),

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
