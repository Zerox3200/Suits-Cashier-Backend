import { Router } from "express";
import {
  CheckToken,
  CheckAdmin,
  CheckCashierOrAdmin,
} from "../../middleware/Admin.middleware.js";
import {
  CreateCategoryValidation,
  UpdateCategoryValidation,
} from "./categories.validation.js";
import {
  CreateCategory,
  GetCategories,
  GetCategory,
  UpdateCategory,
  DeleteCategory,
  RestoreCategory,
} from "./categories.controller.js";

const router = Router();

// Cashiers can list; create is admin-only
router.post(
  "/",
  CheckToken,
  CheckAdmin,
  CreateCategoryValidation,
  CreateCategory
);
router.get("/", CheckToken, CheckCashierOrAdmin, GetCategories);
router.get("/:id", CheckToken, CheckCashierOrAdmin, GetCategory);

// Admin-only mutations
router.put(
  "/:id",
  CheckToken,
  CheckAdmin,
  UpdateCategoryValidation,
  UpdateCategory
);
router.delete("/:id", CheckToken, CheckAdmin, DeleteCategory);
router.patch("/:id/restore", CheckToken, CheckAdmin, RestoreCategory);

export default router;
