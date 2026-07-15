import { Router } from "express";
import {
  CreateUserValidation,
  LoginValidation,
  UpdateUserPasswordValidation,
  UpdateUserRoleValidation,
} from "./auth.Validation.js";
import {
  Login,
  CreateUser,
  CheckUser,
  ListUsers,
  UpdateUserPassword,
  UpdateUserRole,
} from "./auth.controller.js";
import { CheckAdmin, CheckToken } from "../../middleware/Admin.middleware.js";

const router = Router();

router.post("/login", LoginValidation, Login);
router.post("/users", CheckToken, CheckAdmin, CreateUserValidation, CreateUser);
router.get("/users", CheckToken, CheckAdmin, ListUsers);
router.patch(
  "/users/:id/password",
  CheckToken,
  CheckAdmin,
  UpdateUserPasswordValidation,
  UpdateUserPassword
);
router.patch(
  "/users/:id/role",
  CheckToken,
  CheckAdmin,
  UpdateUserRoleValidation,
  UpdateUserRole
);
router.get("/me", CheckToken, CheckUser);

export default router;
