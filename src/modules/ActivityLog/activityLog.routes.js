import { Router } from "express";
import { CheckToken, CheckAdmin } from "../../middleware/Admin.middleware.js";
import { GetActivityLogs } from "./activityLog.controller.js";

const router = Router();

router.get("/", CheckToken, CheckAdmin, GetActivityLogs);

export default router;
