import { ErrorCatch } from "../../utils/ErrorCatch.js";
import joi from "joi";
import { sendError } from "../../utils/response.js";
import { STOCK_ADJUST_REASON } from "../../constants/enums.js";

export const AdjustStockValidation = ErrorCatch(async (req, res, next) => {
  const schema = joi.object({
    quantity: joi.number().min(0).required().messages({
      "any.required": "الكمية مطلوبة",
      "number.min": "الكمية لا يمكن أن تكون سالبة",
    }),
    reason: joi
      .string()
      .valid(...Object.values(STOCK_ADJUST_REASON))
      .required()
      .messages({
        "any.required": "سبب التعديل مطلوب",
        "any.only": "سبب التعديل غير صالح",
      }),
  });

  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return sendError(res, 400, error.details.map((e) => e.message).join(". "));
  }
  next();
});
