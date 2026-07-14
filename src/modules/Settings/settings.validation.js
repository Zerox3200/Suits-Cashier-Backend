import { ErrorCatch } from "../../utils/ErrorCatch.js";
import joi from "joi";
import { sendError } from "../../utils/response.js";

export const UpdateSettingsValidation = ErrorCatch(async (req, res, next) => {
  if (req.body.defaultTax !== undefined) {
    req.body.defaultTax = Number(req.body.defaultTax);
  }

  const schema = joi
    .object({
      storeName: joi.string().allow("").optional(),
      phone: joi.string().allow("").optional(),
      address: joi.string().allow("").optional(),
      currency: joi.string().allow("").optional(),
      defaultTax: joi.number().min(0).optional().messages({
        "number.min": "الضريبة الافتراضية لا يمكن أن تكون سالبة",
      }),
      receiptFooter: joi.string().allow("").optional(),
    })
    .min(0);

  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return sendError(res, 400, error.details.map((e) => e.message).join(". "));
  }
  next();
});
