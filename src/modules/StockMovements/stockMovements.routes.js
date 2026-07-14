import { Router } from "express";
import { CheckToken, CheckAdmin } from "../../middleware/Admin.middleware.js";
import { GetStockMovements } from "./stockMovements.controller.js";

const router = Router();

router.get("/", CheckToken, CheckAdmin, GetStockMovements);

export default router;
