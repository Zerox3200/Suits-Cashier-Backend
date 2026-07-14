import { ActivityLog } from "../../../DB/ActivityLog/ActivityLog.model.js";

export const activityLogRepository = {
  create: (data, session = null) => {
    if (session) {
      return ActivityLog.create([data], { session }).then((docs) => docs[0]);
    }
    return ActivityLog.create(data);
  },

  findPaginated: async ({ skip, limit, filter = {} }) => {
    const [items, total] = await Promise.all([
      ActivityLog.find(filter)
        .populate("user", "name email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ActivityLog.countDocuments(filter),
    ]);
    return { items, total };
  },
};
