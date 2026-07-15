import { ErrorCatch } from "../../utils/ErrorCatch.js";
import joi from "joi";
import { sendError } from "../../utils/response.js";

/** Egyptian mobile when provided; empty string allowed. */
const STORE_PHONE = /^$|^01[0125][0-9]{8}$/;

const SUPPORTED_CURRENCIES = ["EGP", "USD", "SAR", "AED", "EUR"];

export const UpdateSettingsValidation = ErrorCatch(async (req, res, next) => {
  if (req.body.defaultTax !== undefined) {
    req.body.defaultTax = Number(req.body.defaultTax);
  }
  if (typeof req.body.currency === "string") {
    req.body.currency = req.body.currency.trim().toUpperCase();
  }

  const schema = joi
    .object({
      storeName: joi.string().allow("").max(200).optional(),
      phone: joi
        .string()
        .allow("")
        .pattern(STORE_PHONE)
        .optional()
        .messages({
          "string.pattern.base": "رقم الهاتف غير صالح",
        }),
      address: joi.string().allow("").max(500).optional(),
      currency: joi
        .string()
        .valid(...SUPPORTED_CURRENCIES)
        .optional()
        .messages({
          "any.only": `العملة يجب أن تكون واحدة من: ${SUPPORTED_CURRENCIES.join(", ")}`,
        }),
      defaultTax: joi.number().min(0).max(100).optional().messages({
        "number.min": "الضريبة الافتراضية لا يمكن أن تكون سالبة",
        "number.max": "الضريبة الافتراضية لا يمكن أن تتجاوز 100",
      }),
      receiptFooter: joi.string().allow("").max(2000).optional(),
      receiptWidth: joi.string().valid("58mm", "80mm").optional(),
      taxNumber: joi.string().allow("").max(100).optional(),
      companyRegNumber: joi.string().allow("").max(100).optional(),
    })
    .min(0);

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
