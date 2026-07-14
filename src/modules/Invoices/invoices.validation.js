import { ErrorCatch } from "../../utils/ErrorCatch.js";
import joi from "joi";
import { sendError } from "../../utils/response.js";
import { PAYMENT_METHODS } from "../../constants/enums.js";

const objectId = joi.string().hex().length(24).messages({
  "string.hex": "المعرّف غير صالح",
  "string.length": "المعرّف غير صالح",
});

export const CreateInvoiceValidation = ErrorCatch(async (req, res, next) => {
  const schema = joi.object({
    customerName: joi.string().allow("").optional(),
    customerPhone: joi.string().allow("").optional(),
    items: joi
      .array()
      .items(
        joi.object({
          productId: objectId.required().messages({
            "any.required": "معرّف المنتج مطلوب",
          }),
          quantity: joi.number().integer().min(1).required().messages({
            "any.required": "الكمية مطلوبة",
            "number.min": "يجب أن تكون الكمية 1 على الأقل",
          }),
        })
      )
      .min(1)
      .required()
      .messages({
        "array.min": "يجب إضافة منتج واحد على الأقل",
        "any.required": "عناصر الفاتورة مطلوبة",
      }),
    discount: joi.number().min(0).optional().messages({
      "number.min": "الخصم لا يمكن أن يكون سالبًا",
    }),
    tax: joi.number().min(0).optional().messages({
      "number.min": "الضريبة لا يمكن أن تكون سالبة",
    }),
    paymentMethod: joi
      .string()
      .valid(...Object.values(PAYMENT_METHODS))
      .required()
      .messages({
        "any.required": "طريقة الدفع مطلوبة",
        "any.only": "طريقة الدفع يجب أن تكون نقدي أو فيزا",
      }),
    notes: joi.string().allow("").optional(),
  });

  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return sendError(res, 400, error.details.map((e) => e.message).join(". "));
  }
  next();
});

export const ReturnInvoiceValidation = ErrorCatch(async (req, res, next) => {
  const schema = joi.object({
    returnReason: joi.string().trim().min(1).required().messages({
      "any.required": "سبب الإرجاع مطلوب",
      "string.empty": "سبب الإرجاع مطلوب",
    }),
  });

  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return sendError(res, 400, error.details.map((e) => e.message).join(". "));
  }
  next();
});
