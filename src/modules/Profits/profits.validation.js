import joi from "joi";
import { sendError } from "../../utils/response.js";

const dateSchema = joi.object({
  from: joi.date().iso().optional().messages({
    "date.format": "تاريخ البداية يجب أن يكون بصيغة YYYY-MM-DD",
    "date.base": "تاريخ البداية غير صالح",
  }),
  to: joi.date().iso().optional().messages({
    "date.format": "تاريخ النهاية يجب أن يكون بصيغة YYYY-MM-DD",
    "date.base": "تاريخ النهاية غير صالح",
  }),
}).custom((value, helpers) => {
  if (value.from && value.to && new Date(value.from) > new Date(value.to)) {
    return helpers.error("any.invalid");
  }
  return value;
}).messages({
  "any.invalid": "تاريخ البداية يجب أن يكون قبل تاريخ النهاية",
});

export const validateProfitsQuery = (req, res, next) => {
  const { error, value } = dateSchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    return sendError(res, 400, error.details.map((e) => e.message).join(". "));
  }
  req.query = value;
  next();
};
