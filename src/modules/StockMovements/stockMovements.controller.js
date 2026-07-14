import { ErrorCatch } from "../../utils/ErrorCatch.js";
import { sendSuccess } from "../../utils/response.js";
import { listStockMovements } from "./stockMovements.service.js";
import { MSG } from "../../constants/messages.ar.js";

export const GetStockMovements = ErrorCatch(async (req, res) => {
  const data = await listStockMovements(req.query);
  return sendSuccess(res, 200, MSG.STOCK_MOVEMENTS_RETRIEVED, data);
});
