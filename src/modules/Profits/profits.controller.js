import { ErrorCatch } from "../../utils/ErrorCatch.js";
import { sendSuccess } from "../../utils/response.js";
import { getDailyProfits } from "./profits.service.js";
import { MSG } from "../../constants/messages.ar.js";

export const GetDailyProfits = ErrorCatch(async (req, res) => {
  const data = await getDailyProfits(req.query);
  return sendSuccess(res, 200, MSG.PROFITS_RETRIEVED, data);
});
