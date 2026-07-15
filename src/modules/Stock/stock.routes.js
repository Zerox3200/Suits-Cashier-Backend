import { Router } from "express";
import {
  CheckToken,
  CheckAdmin,
  CheckCashierOrAdmin,
} from "../../middleware/Admin.middleware.js";
import { AdjustStockValidation } from "./stock.validation.js";
import {
  GetStockList,
  GetStockByProduct,
  AdjustStock,
  GetLowStock,
} from "./stock.controller.js";

const router = Router();

router.get("/", CheckToken, CheckCashierOrAdmin, GetStockList);
router.get("/low", CheckToken, CheckCashierOrAdmin, GetLowStock);
router.get("/:productId", CheckToken, CheckCashierOrAdmin, GetStockByProduct);
router.patch(
  "/:productId",
  CheckToken,
  CheckCashierOrAdmin,
  AdjustStockValidation,
  AdjustStock
);

export default router;
