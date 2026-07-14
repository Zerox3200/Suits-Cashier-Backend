import { Router } from "express";
import {
  CheckToken,
  CheckAdmin,
  CheckCashierOrAdmin,
} from "../../middleware/Admin.middleware.js";
import {
  CreateInvoiceValidation,
  ReturnInvoiceValidation,
} from "./invoices.validation.js";
import {
  CreateInvoice,
  GetInvoices,
  GetInvoice,
  GetInvoiceByNumber,
  ReturnInvoice,
} from "./invoices.controller.js";

const router = Router();

router.post(
  "/",
  CheckToken,
  CheckCashierOrAdmin,
  CreateInvoiceValidation,
  CreateInvoice
);

router.get("/", CheckToken, CheckCashierOrAdmin, GetInvoices);
router.get("/number/:invoiceNumber", CheckToken, CheckCashierOrAdmin, GetInvoiceByNumber);
router.get("/:id", CheckToken, CheckCashierOrAdmin, GetInvoice);

router.post(
  "/:id/return",
  CheckToken,
  CheckAdmin,
  ReturnInvoiceValidation,
  ReturnInvoice
);

export default router;
