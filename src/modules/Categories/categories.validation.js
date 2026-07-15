import { ErrorCatch } from "../../utils/ErrorCatch.js";
import joi from "joi";
import { sendError } from "../../utils/response.js";

export const CreateCategoryValidation = ErrorCatch(async (req, res, next) => {
  const schema = joi.object({
    name: joi.string().trim().min(1).max(200).required().messages({
      "string.empty": "اسم التصنيف مطلوب",
      "string.max": "اسم التصنيف طويل جدًا",
      "any.required": "اسم التصنيف مطلوب",
    }),
    description: joi.string().allow("").max(2000).optional(),
    isActive: joi.boolean().optional(),
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

export const UpdateCategoryValidation = ErrorCatch(async (req, res, next) => {
  const schema = joi
    .object({
      name: joi.string().trim().min(1).max(200).optional().messages({
        "string.empty": "اسم التصنيف مطلوب",
        "string.max": "اسم التصنيف طويل جدًا",
      }),
      description: joi.string().allow("").max(2000).optional(),
      isActive: joi.boolean().optional(),
    })
    .min(1)
    .messages({
      "object.min": "يجب إرسال حقل واحد على الأقل للتحديث",
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
