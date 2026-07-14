import { Router } from "express";
import { CreateUserValidation, LoginValidation } from "./auth.Validation.js";
import { Login, CreateUser, CheckUser, ListUsers } from "./auth.controller.js";
import { CheckAdmin, CheckToken } from "../../middleware/Admin.middleware.js";

const router = Router();

router.post("/login", LoginValidation, Login);
router.post("/users", CheckToken, CheckAdmin, CreateUserValidation, CreateUser);
router.get("/users", CheckToken, CheckAdmin, ListUsers);
router.get("/me", CheckToken, CheckUser);

export default router;
