import { User } from "../../../DB/Users/Users.js";
import { ErrorCatch } from "../../utils/ErrorCatch.js";
import argon2 from "argon2";
import JWT from "jsonwebtoken";
import mongoose from "mongoose";
import { sendSuccess, sendError } from "../../utils/response.js";
import { ROLES, ACTIVITY_ACTIONS, ACTIVITY_ENTITIES } from "../../constants/enums.js";
import { createActivityLog } from "../ActivityLog/activityLog.service.js";
import { MSG } from "../../constants/messages.ar.js";

const getJwtSecret = () => process.env.JWT_SECRET || process.env.secretkey;

const sanitizeUser = (user) => {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  return obj;
};

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

export const Login = ErrorCatch(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const { password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return sendError(res, 400, MSG.USER_NOT_FOUND);
  }

  if (user.isFrozen) {
    return sendError(res, 403, MSG.ACCOUNT_FROZEN);
  }

  if (!user.password || !user.password.startsWith("$")) {
    return sendError(res, 400, MSG.PASSWORD_RESET_NEEDED);
  }

  const isPasswordValid = await argon2.verify(user.password, password);
  if (!isPasswordValid) {
    return sendError(res, 400, MSG.INCORRECT_PASSWORD);
  }

  const token = JWT.sign({ id: user._id }, getJwtSecret(), {
    algorithm: "HS256",
  });

  return sendSuccess(res, 200, MSG.LOGIN_SUCCESS, {
    user: sanitizeUser(user),
    token,
  });
});

export const CreateUser = ErrorCatch(async (req, res) => {
  const { name, password, phone, role } = req.body;
  const email = normalizeEmail(req.body.email);

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return sendError(res, 400, MSG.USER_EXISTS);
  }

  const hashedPassword = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });

  const userRole = role && Object.values(ROLES).includes(role) ? role : ROLES.CASHIER;

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    phone,
    role: userRole,
  });

  await createActivityLog({
    user: req.user._id,
    action: ACTIVITY_ACTIONS.CREATED_USER,
    entity: ACTIVITY_ENTITIES.USER,
    entityId: user._id,
    description: MSG.LOG_CREATED_USER(user.email, user.role),
  });

  return sendSuccess(res, 201, MSG.USER_CREATED, {
    user: sanitizeUser(user),
  });
});

export const CheckUser = ErrorCatch(async (req, res) => {
  return sendSuccess(res, 200, MSG.USER_AUTHENTICATED, {
    user: sanitizeUser(req.user),
  });
});

export const ListUsers = ErrorCatch(async (req, res) => {
  const users = await User.find().select("-password").sort({ createdAt: -1 });
  return sendSuccess(res, 200, MSG.USERS_RETRIEVED, { users });
});

export const UpdateUserPassword = ErrorCatch(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 400, MSG.INVALID_ID);
  }

  const { password } = req.body;
  const user = await User.findById(id);

  if (!user) {
    return sendError(res, 404, MSG.USER_NOT_FOUND);
  }

  const hashedPassword = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });

  user.password = hashedPassword;
  await user.save();

  await createActivityLog({
    user: req.user._id,
    action: ACTIVITY_ACTIONS.UPDATED_USER_PASSWORD,
    entity: ACTIVITY_ENTITIES.USER,
    entityId: user._id,
    description: MSG.LOG_UPDATED_USER_PASSWORD(user.email),
  });

  return sendSuccess(res, 200, MSG.USER_PASSWORD_UPDATED, {
    user: sanitizeUser(user),
  });
});

export const UpdateUserRole = ErrorCatch(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 400, MSG.INVALID_ID);
  }

  const { role } = req.body;
  const user = await User.findById(id);

  if (!user) {
    return sendError(res, 404, MSG.USER_NOT_FOUND);
  }

  user.role = role;
  await user.save();

  await createActivityLog({
    user: req.user._id,
    action: ACTIVITY_ACTIONS.UPDATED_USER_ROLE,
    entity: ACTIVITY_ENTITIES.USER,
    entityId: user._id,
    description: MSG.LOG_UPDATED_USER_ROLE(user.email, user.role),
  });

  return sendSuccess(res, 200, MSG.USER_ROLE_UPDATED, {
    user: sanitizeUser(user),
  });
});
