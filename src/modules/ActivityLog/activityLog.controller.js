import { ErrorCatch } from "../../utils/ErrorCatch.js";
import { sendSuccess } from "../../utils/response.js";
import { listActivityLogs } from "./activityLog.service.js";
import { MSG } from "../../constants/messages.ar.js";

export const GetActivityLogs = ErrorCatch(async (req, res) => {
  const data = await listActivityLogs(req.query);
  return sendSuccess(res, 200, MSG.ACTIVITY_LOGS_RETRIEVED, data);
});
