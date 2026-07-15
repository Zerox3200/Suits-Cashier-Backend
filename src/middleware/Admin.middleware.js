import JWT from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../../DB/Users/Users.js";
import { ErrorCatch } from "../utils/ErrorCatch.js";
import { sendError } from "../utils/response.js";
import { ROLES } from "../constants/enums.js";
import { MSG } from "../constants/messages.ar.js";

const getJwtSecret = () => process.env.JWT_SECRET || process.env.secretkey;

export const CheckToken = ErrorCatch(async (req, res, next) => {
  const { token } = req.headers;
  if (!token) {
    return sendError(res, 401, MSG.NOT_AUTHORIZED);
  }

  let decoded;
  try {
    decoded = JWT.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
  } catch {
    return sendError(res, 401, MSG.NOT_AUTHORIZED);
  }

  if (!decoded?.id || !mongoose.Types.ObjectId.isValid(decoded.id)) {
    return sendError(res, 401, MSG.NOT_AUTHORIZED);
  }

  const user = await User.findById(decoded.id);

  if (!user) {
    return sendError(res, 401, MSG.USER_NOT_FOUND);
  }

  if (user.isFrozen) {
    return sendError(res, 403, MSG.ACCOUNT_FROZEN);
  }

  req.user = user;
  req.id = user._id;
  next();
});

export const CheckAdmin = ErrorCatch(async (req, res, next) => {
  if (!req.user) {
    return sendError(res, 401, MSG.NOT_AUTHORIZED);
  }

  if (req.user.role !== ROLES.ADMIN) {
    return sendError(res, 403, MSG.ONLY_ADMIN);
  }

  next();
});

export const CheckCashierOrAdmin = ErrorCatch(async (req, res, next) => {
  if (!req.user) {
    return sendError(res, 401, MSG.NOT_AUTHORIZED);
  }

  if (![ROLES.ADMIN, ROLES.CASHIER].includes(req.user.role)) {
    return sendError(res, 403, MSG.ACCESS_DENIED);
  }

  next();
});
