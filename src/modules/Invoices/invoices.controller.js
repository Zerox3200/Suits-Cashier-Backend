import { ErrorCatch } from "../../utils/ErrorCatch.js";
import { sendSuccess } from "../../utils/response.js";
import {
  createInvoice,
  listInvoices,
  getInvoiceById,
  getInvoiceByNumber,
  returnInvoice,
} from "./invoices.service.js";
import { MSG } from "../../constants/messages.ar.js";

export const CreateInvoice = ErrorCatch(async (req, res) => {
  const invoice = await createInvoice(req.body, req.user._id);
  return sendSuccess(res, 201, MSG.INVOICE_CREATED, { invoice });
});

export const GetInvoices = ErrorCatch(async (req, res) => {
  const data = await listInvoices(req.query, req.user);
  return sendSuccess(res, 200, MSG.INVOICES_RETRIEVED, data);
});

export const GetInvoice = ErrorCatch(async (req, res) => {
  const invoice = await getInvoiceById(req.params.id);
  return sendSuccess(res, 200, MSG.INVOICE_RETRIEVED, { invoice });
});

export const GetInvoiceByNumber = ErrorCatch(async (req, res) => {
  const invoice = await getInvoiceByNumber(req.params.invoiceNumber);
  return sendSuccess(res, 200, MSG.INVOICE_RETRIEVED, { invoice });
});

export const ReturnInvoice = ErrorCatch(async (req, res) => {
  const invoice = await returnInvoice(req.params.id, req.body, req.user._id);
  return sendSuccess(res, 200, MSG.INVOICE_RETURNED, { invoice });
});
