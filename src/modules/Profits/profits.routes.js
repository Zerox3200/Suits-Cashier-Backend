import { Router } from "express";
import { CheckToken, CheckAdmin } from "../../middleware/Admin.middleware.js";
import { GetDailyProfits } from "./profits.controller.js";
import { validateProfitsQuery } from "./profits.validation.js";

const router = Router();

router.get("/", CheckToken, CheckAdmin, validateProfitsQuery, GetDailyProfits);

export default router;
