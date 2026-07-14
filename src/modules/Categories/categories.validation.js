import { ErrorCatch } from "../../utils/ErrorCatch.js";
import joi from "joi";
import { sendError } from "../../utils/response.js";

export const CreateCategoryValidation = ErrorCatch(async (req, res, next) => {
  const schema = joi.object({
    name: joi.string().trim().min(1).required().messages({
      "string.empty": "اسم التصنيف مطلوب",
      "any.required": "اسم التصنيف مطلوب",
    }),
    description: joi.string().allow("").optional(),
    isActive: joi.boolean().optional(),
  });
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return sendError(res, 400, error.details.map((e) => e.message).join(". "));
  }
  next();
});

export const UpdateCategoryValidation = ErrorCatch(async (req, res, next) => {
  const schema = joi
    .object({
      name: joi.string().trim().min(1).optional().messages({
        "string.empty": "اسم التصنيف مطلوب",
      }),
      description: joi.string().allow("").optional(),
      isActive: joi.boolean().optional(),
    })
    .min(1)
    .messages({
      "object.min": "يجب إرسال حقل واحد على الأقل للتحديث",
    });
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return sendError(res, 400, error.details.map((e) => e.message).join(". "));
  }
  next();
});
