import { Category } from "../../../DB/Categories/Categories.model.js";

export const categoryRepository = {
  create: (data) => Category.create(data),

  findById: (id) => Category.findById(id),

  findByName: (name) => Category.findOne({ name }),

  findPaginated: async ({ skip, limit, filter = {} }) => {
    const [items, total] = await Promise.all([
      Category.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Category.countDocuments(filter),
    ]);
    return { items, total };
  },

  updateById: (id, data) =>
    Category.findByIdAndUpdate(id, data, { new: true, runValidators: true }),

  deleteById: (id) => Category.findByIdAndDelete(id),
};
