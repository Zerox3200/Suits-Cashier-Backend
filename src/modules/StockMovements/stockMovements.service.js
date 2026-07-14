import { stockMovementRepository } from "./stockMovements.repository.js";
import { getPagination, buildPaginationResult } from "../../utils/pagination.js";

export const listStockMovements = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.productId) filter.productId = query.productId;
  if (query.type) filter.type = query.type;
  if (query.reason) filter.reason = query.reason;

  const { items, total } = await stockMovementRepository.findPaginated({
    skip,
    limit,
    filter,
  });
  return buildPaginationResult(items, total, page, limit);
};
