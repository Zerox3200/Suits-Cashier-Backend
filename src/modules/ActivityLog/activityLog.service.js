import { activityLogRepository } from "./activityLog.repository.js";
import { getPagination, buildPaginationResult } from "../../utils/pagination.js";

export const createActivityLog = async (payload, session = null) => {
  return activityLogRepository.create(payload, session);
};

export const listActivityLogs = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const { items, total } = await activityLogRepository.findPaginated({ skip, limit });
  return buildPaginationResult(items, total, page, limit);
};
