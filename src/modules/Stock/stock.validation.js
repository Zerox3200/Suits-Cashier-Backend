import { ErrorCatch } from "../../utils/ErrorCatch.js";
import joi from "joi";
import { sendError } from "../../utils/response.js";
import { STOCK_ADJUST_REASON } from "../../constants/enums.js";

export const AdjustStockValidation = ErrorCatch(async (req, res, next) => {
  if (req.body.quantity !== undefined) {
    req.body.quantity = Number(req.body.quantity);
  }

  const schema = joi.object({
    quantity: joi.number().integer().min(0).required().messages({
      "any.required": "الكمية مطلوبة",
      "number.base": "الكمية يجب أن تكون رقمًا",
      "number.min": "الكمية لا يمكن أن تكون سالبة",
      "number.integer": "الكمية يجب أن تكون عددًا صحيحًا",
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

  const { error, value } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return sendError(res, 400, error.details.map((e) => e.message).join(". "));
  }
  req.body = value;
  next();
});
