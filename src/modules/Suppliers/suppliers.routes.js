import { Router } from "express";
import {
  CheckToken,
  CheckAdmin,
  CheckCashierOrAdmin,
} from "../../middleware/Admin.middleware.js";
import {
  CreateSupplierValidation,
  UpdateSupplierValidation,
} from "./suppliers.validation.js";
import {
  CreateSupplier,
  GetSuppliers,
  GetSupplier,
  UpdateSupplier,
  DeleteSupplier,
  RestoreSupplier,
} from "./suppliers.controller.js";

const router = Router();

// Cashiers can list; create is admin-only
router.post(
  "/",
  CheckToken,
  CheckAdmin,
  CreateSupplierValidation,
  CreateSupplier
);
router.get("/", CheckToken, CheckCashierOrAdmin, GetSuppliers);
router.get("/:id", CheckToken, CheckCashierOrAdmin, GetSupplier);

// Admin-only mutations
router.put(
  "/:id",
  CheckToken,
  CheckAdmin,
  UpdateSupplierValidation,
  UpdateSupplier
);
router.delete("/:id", CheckToken, CheckAdmin, DeleteSupplier);
router.patch("/:id/restore", CheckToken, CheckAdmin, RestoreSupplier);

export default router;
