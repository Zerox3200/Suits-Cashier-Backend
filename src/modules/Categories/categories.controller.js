import { ErrorCatch } from "../../utils/ErrorCatch.js";
import { sendSuccess } from "../../utils/response.js";
import {
  createCategory,
  listCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  restoreCategory,
} from "./categories.service.js";
import { MSG } from "../../constants/messages.ar.js";

export const CreateCategory = ErrorCatch(async (req, res) => {
  const category = await createCategory(req.body, req.user._id);
  return sendSuccess(res, 201, MSG.CATEGORY_CREATED, { category });
});

export const GetCategories = ErrorCatch(async (req, res) => {
  const data = await listCategories(req.query);
  return sendSuccess(res, 200, MSG.CATEGORIES_RETRIEVED, data);
});

export const GetCategory = ErrorCatch(async (req, res) => {
  const category = await getCategoryById(req.params.id);
  return sendSuccess(res, 200, MSG.CATEGORY_RETRIEVED, { category });
});

export const UpdateCategory = ErrorCatch(async (req, res) => {
  const category = await updateCategory(req.params.id, req.body, req.user._id);
  return sendSuccess(res, 200, MSG.CATEGORY_UPDATED, { category });
});

export const DeleteCategory = ErrorCatch(async (req, res) => {
  const category = await deleteCategory(req.params.id, req.user._id);
  return sendSuccess(res, 200, MSG.CATEGORY_DELETED, { category });
});

export const RestoreCategory = ErrorCatch(async (req, res) => {
  const category = await restoreCategory(req.params.id, req.user._id);
  return sendSuccess(res, 200, MSG.CATEGORY_RESTORED, { category });
});
