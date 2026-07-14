import { supplierRepository } from "./suppliers.repository.js";
import { getPagination, buildPaginationResult } from "../../utils/pagination.js";
import { createActivityLog } from "../ActivityLog/activityLog.service.js";
import { ACTIVITY_ACTIONS, ACTIVITY_ENTITIES } from "../../constants/enums.js";
import { MSG } from "../../constants/messages.ar.js";

export const createSupplier = async (payload, userId) => {
  const supplier = await supplierRepository.create({
    ...payload,
    createdBy: userId,
    updatedBy: userId,
  });

  await createActivityLog({
    user: userId,
    action: ACTIVITY_ACTIONS.CREATED_SUPPLIER,
    entity: ACTIVITY_ENTITIES.SUPPLIER,
    entityId: supplier._id,
    description: MSG.LOG_CREATED_SUPPLIER(supplier.name),
  });

  return supplier;
};

export const listSuppliers = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === "true";
  }
  if (query.search) {
    filter.name = { $regex: query.search, $options: "i" };
  }
  const { items, total } = await supplierRepository.findPaginated({ skip, limit, filter });
  return buildPaginationResult(items, total, page, limit);
};

export const getSupplierById = async (id) => {
  const supplier = await supplierRepository.findById(id);
  if (!supplier) {
    const error = new Error(MSG.SUPPLIER_NOT_FOUND);
    error.cause = 404;
    throw error;
  }
  return supplier;
};

export const updateSupplier = async (id, payload, userId) => {
  const supplier = await supplierRepository.updateById(id, {
    ...payload,
    updatedBy: userId,
  });

  if (!supplier) {
    const error = new Error(MSG.SUPPLIER_NOT_FOUND);
    error.cause = 404;
    throw error;
  }

  await createActivityLog({
    user: userId,
    action: ACTIVITY_ACTIONS.UPDATED_SUPPLIER,
    entity: ACTIVITY_ENTITIES.SUPPLIER,
    entityId: supplier._id,
    description: MSG.LOG_UPDATED_SUPPLIER(supplier.name),
  });

  return supplier;
};

export const deleteSupplier = async (id, userId) => {
  const supplier = await supplierRepository.findById(id);
  if (!supplier) {
    const error = new Error(MSG.SUPPLIER_NOT_FOUND);
    error.cause = 404;
    throw error;
  }

  const updatedSupplier = await supplierRepository.updateById(id, {
    isActive: false,
    updatedBy: userId,
  });

  await createActivityLog({
    user: userId,
    action: ACTIVITY_ACTIONS.UPDATED_SUPPLIER,
    entity: ACTIVITY_ENTITIES.SUPPLIER,
    entityId: supplier._id,
    description: MSG.LOG_DELETED_SUPPLIER(supplier.name),
  });

  return updatedSupplier;
};

export const restoreSupplier = async (id, userId) => {
  const supplier = await supplierRepository.findById(id);
  if (!supplier) {
    const error = new Error(MSG.SUPPLIER_NOT_FOUND);
    error.cause = 404;
    throw error;
  }

  if (supplier.isActive) {
    const error = new Error(MSG.SUPPLIER_ALREADY_ACTIVE);
    error.cause = 400;
    throw error;
  }

  const restoredSupplier = await supplierRepository.updateById(id, {
    isActive: true,
    updatedBy: userId,
  });

  await createActivityLog({
    user: userId,
    action: ACTIVITY_ACTIONS.UPDATED_SUPPLIER,
    entity: ACTIVITY_ENTITIES.SUPPLIER,
    entityId: supplier._id,
    description: MSG.LOG_RESTORED_SUPPLIER(supplier.name),
  });

  return restoredSupplier;
};
