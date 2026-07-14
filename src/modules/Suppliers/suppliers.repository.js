import { Supplier } from "../../../DB/Suppliers/Suppliers.model.js";

export const supplierRepository = {
  create: (data) => Supplier.create(data),

  findById: (id) => Supplier.findById(id),

  findPaginated: async ({ skip, limit, filter = {} }) => {
    const [items, total] = await Promise.all([
      Supplier.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Supplier.countDocuments(filter),
    ]);
    return { items, total };
  },

  updateById: (id, data) =>
    Supplier.findByIdAndUpdate(id, data, { new: true, runValidators: true }),

  deleteById: (id) => Supplier.findByIdAndDelete(id),
};
