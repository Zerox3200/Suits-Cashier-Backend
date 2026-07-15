import { Stock } from "../../../DB/Stock/Stock.model.js";

export const stockRepository = {
  create: (data, session = null) => {
    if (session) {
      return Stock.create([data], { session }).then((docs) => docs[0]);
    }
    return Stock.create(data);
  },

  findByProductId: (productId, session = null) => {
    const q = Stock.findOne({ productId });
    if (session) q.session(session);
    return q;
  },

  findManyByProductIds: (productIds, session = null) => {
    const q = Stock.find({ productId: { $in: productIds } });
    if (session) q.session(session);
    return q;
  },

  updateByProductId: (productId, data, session = null) => {
    const opts = { new: true, runValidators: true };
    if (session) opts.session = session;
    return Stock.findOneAndUpdate({ productId }, data, opts);
  },

  /**
   * Atomically decrease stock only if enough quantity remains.
   * Returns null when stock is missing or insufficient (safe for concurrent sales).
   */
  decrementIfAvailable: (productId, quantity, session = null) => {
    const opts = { new: true, runValidators: true };
    if (session) opts.session = session;
    return Stock.findOneAndUpdate(
      { productId, quantity: { $gte: quantity } },
      {
        $inc: { quantity: -quantity },
        $set: { lastUpdated: new Date() },
      },
      opts
    );
  },

  incrementQuantity: (productId, quantity, session = null) => {
    const opts = { new: true, runValidators: true };
    if (session) opts.session = session;
    return Stock.findOneAndUpdate(
      { productId },
      {
        $inc: { quantity },
        $set: { lastUpdated: new Date() },
      },
      opts
    );
  },

  findPaginated: async ({ skip, limit, filter = {} }) => {
    const [items, total] = await Promise.all([
      Stock.find(filter)
        .populate({
          path: "productId",
          populate: [
            { path: "categoryId", select: "name" },
            { path: "supplierId", select: "name" },
          ],
        })
        .sort({ lastUpdated: -1 })
        .skip(skip)
        .limit(limit),
      Stock.countDocuments(filter),
    ]);
    return { items, total };
  },

  findLowStock: async () => {
    // Quantity above zero but at/below reorder threshold (zero → outOfStock only)
    return Stock.find({
      quantity: { $gt: 0 },
      $expr: { $lte: ["$quantity", "$minimumQuantity"] },
    }).populate("productId");
  },

  findOutOfStock: async () => {
    return Stock.find({ quantity: 0 }).populate("productId");
  },
};
