import { StockMovement } from "../../../DB/StockMovements/StockMovements.model.js";

export const stockMovementRepository = {
  create: (data, session = null) => {
    if (session) {
      return StockMovement.create([data], { session }).then((docs) => docs[0]);
    }
    return StockMovement.create(data);
  },

  createMany: (docs, session = null) => {
    if (session) {
      return StockMovement.create(docs, { session });
    }
    return StockMovement.insertMany(docs);
  },

  findPaginated: async ({ skip, limit, filter = {} }) => {
    const [items, total] = await Promise.all([
      StockMovement.find(filter)
        .populate("productId", "name sku")
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      StockMovement.countDocuments(filter),
    ]);
    return { items, total };
  },
};
