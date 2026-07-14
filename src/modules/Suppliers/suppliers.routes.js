import { Router } from "express";
import { CheckToken, CheckAdmin } from "../../middleware/Admin.middleware.js";
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

router.post("/", CheckToken, CheckAdmin, CreateSupplierValidation, CreateSupplier);
router.get("/", CheckToken, CheckAdmin, GetSuppliers);
router.get("/:id", CheckToken, CheckAdmin, GetSupplier);
router.put("/:id", CheckToken, CheckAdmin, UpdateSupplierValidation, UpdateSupplier);
router.delete("/:id", CheckToken, CheckAdmin, DeleteSupplier);
router.patch("/:id/restore", CheckToken, CheckAdmin, RestoreSupplier);

export default router;
