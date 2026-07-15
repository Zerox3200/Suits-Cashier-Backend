import { categoryRepository } from "./categories.repository.js";
import { productRepository } from "../Products/products.repository.js";
import { getPagination, buildPaginationResult } from "../../utils/pagination.js";
import { createActivityLog } from "../ActivityLog/activityLog.service.js";
import { ACTIVITY_ACTIONS, ACTIVITY_ENTITIES } from "../../constants/enums.js";
import { MSG } from "../../constants/messages.ar.js";

export const createCategory = async (payload, userId) => {
  const existing = await categoryRepository.findByName(payload.name);

  if (existing) {
    const error = new Error(MSG.CATEGORY_EXISTS);
    error.cause = 400;
    throw error;
  }

  const category = await categoryRepository.create({
    ...payload,
    createdBy: userId,
    updatedBy: userId,
  });

  await createActivityLog({
    user: userId,
    action: ACTIVITY_ACTIONS.CREATED_CATEGORY,
    entity: ACTIVITY_ENTITIES.CATEGORY,
    entityId: category._id,
    description: MSG.LOG_CREATED_CATEGORY(category.name),
  });

  return category;
};

export const listCategories = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === "true";
  }
  if (query.search) {
    filter.name = { $regex: query.search, $options: "i" };
  }
  const { items, total } = await categoryRepository.findPaginated({ skip, limit, filter });
  return buildPaginationResult(items, total, page, limit);
};

export const getCategoryById = async (id) => {
  const category = await categoryRepository.findById(id);
  if (!category) {
    const error = new Error(MSG.CATEGORY_NOT_FOUND);
    error.cause = 404;
    throw error;
  }
  return category;
};

export const updateCategory = async (id, payload, userId) => {
  if (payload.name) {
    const existing = await categoryRepository.findByName(payload.name);
    if (existing && existing._id.toString() !== id) {
      const error = new Error(MSG.CATEGORY_EXISTS);
      error.cause = 400;
      throw error;
    }
  }

  const category = await categoryRepository.updateById(id, {
    ...payload,
    updatedBy: userId,
  });

  if (!category) {
    const error = new Error(MSG.CATEGORY_NOT_FOUND);
    error.cause = 404;
    throw error;
  }

  await createActivityLog({
    user: userId,
    action: ACTIVITY_ACTIONS.UPDATED_CATEGORY,
    entity: ACTIVITY_ENTITIES.CATEGORY,
    entityId: category._id,
    description: MSG.LOG_UPDATED_CATEGORY(category.name),
  });

  return category;
};

export const deleteCategory = async (id, userId) => {
  const category = await categoryRepository.findById(id);
  if (!category) {
    const error = new Error(MSG.CATEGORY_NOT_FOUND);
    error.cause = 404;
    throw error;
  }

  await productRepository.softDeleteByCategoryId(id, userId);

  const updatedCategory = await categoryRepository.updateById(id, {
    isActive: false,
    updatedBy: userId,
  });

  await createActivityLog({
    user: userId,
    action: ACTIVITY_ACTIONS.DELETED_CATEGORY,
    entity: ACTIVITY_ENTITIES.CATEGORY,
    entityId: category._id,
    description: MSG.LOG_DELETED_CATEGORY(category.name),
  });

  return updatedCategory;
};

export const restoreCategory = async (id, userId) => {
  const category = await categoryRepository.findById(id);
  if (!category) {
    const error = new Error(MSG.CATEGORY_NOT_FOUND);
    error.cause = 404;
    throw error;
  }

  if (category.isActive) {
    const error = new Error(MSG.CATEGORY_ALREADY_ACTIVE);
    error.cause = 400;
    throw error;
  }

  await productRepository.softRestoreByCategoryId(id, userId);

  const restoredCategory = await categoryRepository.updateById(id, {
    isActive: true,
    updatedBy: userId,
  });

  await createActivityLog({
    user: userId,
    action: ACTIVITY_ACTIONS.RESTORED_CATEGORY,
    entity: ACTIVITY_ENTITIES.CATEGORY,
    entityId: category._id,
    description: MSG.LOG_RESTORED_CATEGORY(category.name),
  });

  return restoredCategory;
};
