import { ErrorCatch } from "../../utils/ErrorCatch.js";
import { sendSuccess } from "../../utils/response.js";
import {
  createSupplier,
  listSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
  restoreSupplier,
} from "./suppliers.service.js";
import { MSG } from "../../constants/messages.ar.js";

export const CreateSupplier = ErrorCatch(async (req, res) => {
  const supplier = await createSupplier(req.body, req.user._id);
  return sendSuccess(res, 201, MSG.SUPPLIER_CREATED, { supplier });
});

export const GetSuppliers = ErrorCatch(async (req, res) => {
  const data = await listSuppliers(req.query);
  return sendSuccess(res, 200, MSG.SUPPLIERS_RETRIEVED, data);
});

export const GetSupplier = ErrorCatch(async (req, res) => {
  const supplier = await getSupplierById(req.params.id);
  return sendSuccess(res, 200, MSG.SUPPLIER_RETRIEVED, { supplier });
});

export const UpdateSupplier = ErrorCatch(async (req, res) => {
  const supplier = await updateSupplier(req.params.id, req.body, req.user._id);
  return sendSuccess(res, 200, MSG.SUPPLIER_UPDATED, { supplier });
});

export const DeleteSupplier = ErrorCatch(async (req, res) => {
  const supplier = await deleteSupplier(req.params.id, req.user._id);
  return sendSuccess(res, 200, MSG.SUPPLIER_DELETED, { supplier });
});

export const RestoreSupplier = ErrorCatch(async (req, res) => {
  const supplier = await restoreSupplier(req.params.id, req.user._id);
  return sendSuccess(res, 200, MSG.SUPPLIER_RESTORED, { supplier });
});
