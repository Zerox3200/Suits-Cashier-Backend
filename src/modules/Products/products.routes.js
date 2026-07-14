import { Router } from "express";
import { CheckToken, CheckAdmin } from "../../middleware/Admin.middleware.js";
import {
  PRODUCT_IMAGE_UPLOAD,
  imageUpload,
} from "../../utils/multer.js";
import {
  CreateProductValidation,
  UpdateProductValidation,
} from "./products.validation.js";
import { AdjustStockValidation } from "../Stock/stock.validation.js";
import {
  CreateProduct,
  GetProducts,
  GetProduct,
  UpdateProduct,
  UpdateProductStock,
  DeactivateProduct,
  RestoreProduct,
} from "./products.controller.js";

const router = Router();

router.post(
  "/",
  CheckToken,
  CheckAdmin,
  ...imageUpload(PRODUCT_IMAGE_UPLOAD),
  CreateProductValidation,
  CreateProduct
);

router.get("/", CheckToken, GetProducts);
router.get("/:id", CheckToken, GetProduct);

router.put(
  "/:id",
  CheckToken,
  CheckAdmin,
  ...imageUpload(PRODUCT_IMAGE_UPLOAD),
  UpdateProductValidation,
  UpdateProduct
);

router.patch(
  "/:id/stock",
  CheckToken,
  CheckAdmin,
  AdjustStockValidation,
  UpdateProductStock
);
router.patch("/:id/deactivate", CheckToken, CheckAdmin, DeactivateProduct);
router.patch("/:id/restore", CheckToken, CheckAdmin, RestoreProduct);

export default router;
