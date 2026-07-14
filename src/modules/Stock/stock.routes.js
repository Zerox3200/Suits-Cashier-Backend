import { Router } from "express";
import { CheckToken, CheckAdmin } from "../../middleware/Admin.middleware.js";
import { AdjustStockValidation } from "./stock.validation.js";
import {
  GetStockList,
  GetStockByProduct,
  AdjustStock,
  GetLowStock,
} from "./stock.controller.js";

const router = Router();

router.get("/", CheckToken, GetStockList);
router.get("/low", CheckToken, CheckAdmin, GetLowStock);
router.get("/:productId", CheckToken, GetStockByProduct);
router.patch(
  "/:productId",
  CheckToken,
  CheckAdmin,
  AdjustStockValidation,
  AdjustStock
);

export default router;
