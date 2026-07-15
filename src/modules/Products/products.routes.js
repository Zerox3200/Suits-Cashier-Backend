import { Router } from "express";
import {
  CheckToken,
  CheckAdmin,
  CheckCashierOrAdmin,
} from "../../middleware/Admin.middleware.js";
import {
  PRODUCT_IMAGE_UPLOAD,
  imageUpload,
} from "../../utils/multer.js";
import {
  CreateProductValidation,
  UpdateProductValidation,
  ScanProductValidation,
} from "./products.validation.js";
import { AdjustStockValidation } from "../Stock/stock.validation.js";
import {
  CreateProduct,
  GetProducts,
  GetProduct,
  ScanProduct,
  UpdateProduct,
  UpdateProductStock,
  DeactivateProduct,
  RestoreProduct,
} from "./products.controller.js";

const router = Router();

router.post(
  "/",
  CheckToken,
  CheckCashierOrAdmin,
  ...imageUpload(PRODUCT_IMAGE_UPLOAD),
  CreateProductValidation,
  CreateProduct
);

router.post("/scan", CheckToken, CheckCashierOrAdmin, ScanProductValidation, ScanProduct);
router.get("/scan/:code", CheckToken, CheckCashierOrAdmin, ScanProduct);

router.get("/", CheckToken, CheckCashierOrAdmin, GetProducts);
router.get("/:id", CheckToken, CheckCashierOrAdmin, GetProduct);

router.put(
  "/:id",
  CheckToken,
  CheckCashierOrAdmin,
  ...imageUpload(PRODUCT_IMAGE_UPLOAD),
  UpdateProductValidation,
  UpdateProduct
);

router.patch(
  "/:id/stock",
  CheckToken,
  CheckCashierOrAdmin,
  AdjustStockValidation,
  UpdateProductStock
);

// Admin-only product lifecycle
router.patch("/:id/deactivate", CheckToken, CheckAdmin, DeactivateProduct);
router.patch("/:id/restore", CheckToken, CheckAdmin, RestoreProduct);

export default router;
