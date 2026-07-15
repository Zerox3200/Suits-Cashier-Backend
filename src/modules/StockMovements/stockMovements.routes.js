import { Router } from "express";
import {
  CheckToken,
  CheckCashierOrAdmin,
} from "../../middleware/Admin.middleware.js";
import { ErrorCatch } from "../../utils/ErrorCatch.js";
import { sendError } from "../../utils/response.js";
import { GetStockMovements } from "./stockMovements.controller.js";

const router = Router();

router.get("/", CheckToken, CheckCashierOrAdmin, GetStockMovements);

/**
 * Direct POST is not supported — movements are created via stock adjust / invoices.
 * Auth gate still applies so guests get 401 and frozen users get 403.
 */
router.post(
  "/",
  CheckToken,
  CheckCashierOrAdmin,
  ErrorCatch(async (_req, res) => {
    return sendError(
      res,
      400,
      "حركات المخزون تُنشأ عبر تعديل المخزون أو الفواتير فقط"
    );
  })
);

export default router;
