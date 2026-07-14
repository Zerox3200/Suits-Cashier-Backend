export const getPagination = (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

export const buildPaginationResult = (data, total, page, limit) => ({
  items: data,
  pagination: {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 0,
  },
});
