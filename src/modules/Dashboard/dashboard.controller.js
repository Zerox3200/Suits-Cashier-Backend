import { ErrorCatch } from "../../utils/ErrorCatch.js";
import { sendSuccess } from "../../utils/response.js";
import { getDashboardStats } from "./dashboard.service.js";
import { MSG } from "../../constants/messages.ar.js";

export const GetDashboard = ErrorCatch(async (req, res) => {
  const data = await getDashboardStats();
  return sendSuccess(res, 200, MSG.DASHBOARD_RETRIEVED, data);
});
