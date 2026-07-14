import { Router } from "express";
import { CheckToken, CheckAdmin } from "../../middleware/Admin.middleware.js";
import { GetDashboard } from "./dashboard.controller.js";

const router = Router();

router.get("/", CheckToken, CheckAdmin, GetDashboard);

export default router;
