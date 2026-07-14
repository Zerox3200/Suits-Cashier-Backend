import { ErrorCatch } from "../../utils/ErrorCatch.js";
import joi from "joi";
import { sendError } from "../../utils/response.js";

export const CreateSupplierValidation = ErrorCatch(async (req, res, next) => {
  const schema = joi.object({
    name: joi.string().trim().min(1).required().messages({
      "string.empty": "اسم المورد مطلوب",
      "any.required": "اسم المورد مطلوب",
    }),
    phone: joi.string().allow("").optional(),
    address: joi.string().allow("").optional(),
    notes: joi.string().allow("").optional(),
    isActive: joi.boolean().optional(),
  });
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return sendError(res, 400, error.details.map((e) => e.message).join(". "));
  }
  next();
});

export const UpdateSupplierValidation = ErrorCatch(async (req, res, next) => {
  const schema = joi
    .object({
      name: joi.string().trim().min(1).optional().messages({
        "string.empty": "اسم المورد مطلوب",
      }),
      phone: joi.string().allow("").optional(),
      address: joi.string().allow("").optional(),
      notes: joi.string().allow("").optional(),
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
