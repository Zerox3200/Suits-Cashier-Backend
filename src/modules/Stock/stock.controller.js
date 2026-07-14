import { ErrorCatch } from "../../utils/ErrorCatch.js";
import { sendSuccess } from "../../utils/response.js";
import {
  listStock,
  getStockByProductId,
  adjustStock,
  listLowStock,
} from "./stock.service.js";
import { MSG } from "../../constants/messages.ar.js";

export const GetStockList = ErrorCatch(async (req, res) => {
  const data = await listStock(req.query);
  return sendSuccess(res, 200, MSG.STOCK_RETRIEVED, data);
});

export const GetStockByProduct = ErrorCatch(async (req, res) => {
  const stock = await getStockByProductId(req.params.productId);
  return sendSuccess(res, 200, MSG.STOCK_RETRIEVED, { stock });
});

export const AdjustStock = ErrorCatch(async (req, res) => {
  const stock = await adjustStock(req.params.productId, req.body, req.user._id);
  return sendSuccess(res, 200, MSG.STOCK_ADJUSTED, { stock });
});

export const GetLowStock = ErrorCatch(async (req, res) => {
  const items = await listLowStock();
  return sendSuccess(res, 200, MSG.LOW_STOCK_RETRIEVED, { items });
});
