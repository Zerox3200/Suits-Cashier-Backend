import { ErrorCatch } from "../../utils/ErrorCatch.js";
import joi from "joi";
import { ROLES } from "../../constants/enums.js";
import { sendError } from "../../utils/response.js";

/** Egyptian mobile: 01[0125] + 8 digits (e.g. 01099998888) */
const EGYPT_PHONE = /^01[0125][0-9]{8}$/;

export const CreateUserValidation = ErrorCatch(async (req, res, next) => {
  const schema = joi.object({
    name: joi.string().min(2).max(50).required().messages({
      "string.empty": "الاسم مطلوب",
      "string.min": "يجب أن يكون الاسم حرفين على الأقل",
      "string.max": "يجب ألا يتجاوز الاسم 50 حرفًا",
      "any.required": "الاسم مطلوب",
    }),
    email: joi
      .string()
      .email({ tlds: { allow: ["com", "net", "org", "edu"] } })
      .lowercase()
      .required()
      .messages({
        "string.empty": "البريد الإلكتروني مطلوب",
        "string.email": "يرجى إدخال بريد إلكتروني صالح",
        "any.required": "البريد الإلكتروني مطلوب",
      }),
    password: joi.string().min(9).required().messages({
      "string.empty": "كلمة المرور مطلوبة",
      "string.min": "يجب أن تكون كلمة المرور 9 أحرف على الأقل",
      "any.required": "كلمة المرور مطلوبة",
    }),
    confirmpassword: joi.string().valid(joi.ref("password")).required().messages({
      "any.only": "كلمتا المرور غير متطابقتين",
      "any.required": "تأكيد كلمة المرور مطلوب",
    }),
    phone: joi.string().pattern(EGYPT_PHONE).required().messages({
      "string.empty": "رقم الهاتف مطلوب",
      "string.pattern.base": "رقم الهاتف غير صالح",
      "any.required": "رقم الهاتف مطلوب",
    }),
    role: joi
      .string()
      .valid(...Object.values(ROLES))
      .optional()
      .messages({
        "any.only": "الدور يجب أن يكون مسؤول أو كاشير",
      }),
  });

  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    return sendError(res, 400, error.details.map((e) => e.message).join(". "));
  }
  req.body = value;
  next();
});

export const LoginValidation = ErrorCatch(async (req, res, next) => {
  const schema = joi.object({
    email: joi
      .string()
      .email({ tlds: { allow: ["com", "net", "org", "edu"] } })
      .lowercase()
      .required()
      .messages({
        "string.empty": "البريد الإلكتروني مطلوب",
        "string.email": "يرجى إدخال بريد إلكتروني صالح",
        "any.required": "البريد الإلكتروني مطلوب",
      }),
    password: joi.string().min(9).max(200).required().messages({
      "string.empty": "كلمة المرور مطلوبة",
      "string.min": "يجب أن تكون كلمة المرور 9 أحرف على الأقل",
      "string.max": "كلمة المرور طويلة جدًا",
      "any.required": "كلمة المرور مطلوبة",
    }),
  });

  const { error, value } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return sendError(res, 400, error.details.map((e) => e.message).join(". "));
  }
  req.body = value;
  next();
});

export const UpdateUserPasswordValidation = ErrorCatch(async (req, res, next) => {
  const schema = joi.object({
    password: joi.string().min(9).required().messages({
      "string.empty": "كلمة المرور مطلوبة",
      "string.min": "يجب أن تكون كلمة المرور 9 أحرف على الأقل",
      "any.required": "كلمة المرور مطلوبة",
    }),
    confirmpassword: joi.string().valid(joi.ref("password")).required().messages({
      "any.only": "كلمتا المرور غير متطابقتين",
      "any.required": "تأكيد كلمة المرور مطلوب",
    }),
  });

  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return sendError(res, 400, error.details.map((e) => e.message).join(". "));
  }
  next();
});

export const UpdateUserRoleValidation = ErrorCatch(async (req, res, next) => {
  const schema = joi.object({
    role: joi
      .string()
      .valid(...Object.values(ROLES))
      .required()
      .messages({
        "any.only": "الدور يجب أن يكون مسؤول أو كاشير",
        "any.required": "الدور مطلوب",
      }),
  });

  const { error, value } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return sendError(res, 400, error.details.map((e) => e.message).join(". "));
  }
  req.body = value;
  next();
});

export const SignUpValidation = CreateUserValidation;
