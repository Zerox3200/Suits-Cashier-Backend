import { ErrorCatch } from "../../utils/ErrorCatch.js";
import joi from "joi";
import { sendError } from "../../utils/response.js";

const objectId = joi.string().hex().length(24).messages({
  "string.hex": "المعرّف غير صالح",
  "string.length": "المعرّف غير صالح",
});

export const CreateProductValidation = ErrorCatch(async (req, res, next) => {
  if (req.body.costPrice !== undefined) req.body.costPrice = Number(req.body.costPrice);
  if (req.body.sellingPrice !== undefined) req.body.sellingPrice = Number(req.body.sellingPrice);
  if (req.body.initialQuantity !== undefined) {
    req.body.initialQuantity = Number(req.body.initialQuantity);
  }
  if (req.body.minimumQuantity !== undefined) {
    req.body.minimumQuantity = Number(req.body.minimumQuantity);
  }

  const schema = joi.object({
    sku: joi.string().trim().required().messages({
      "any.required": "رمز SKU مطلوب",
      "string.empty": "رمز SKU مطلوب",
    }),
    barcode: joi.string().trim().allow("", null).optional(),
    name: joi.string().trim().required().messages({
      "any.required": "اسم المنتج مطلوب",
      "string.empty": "اسم المنتج مطلوب",
    }),
    description: joi.string().allow("").optional(),
    categoryId: objectId.required().messages({
      "any.required": "التصنيف مطلوب",
    }),
    supplierId: objectId.required().messages({
      "any.required": "المورد مطلوب",
    }),
    costPrice: joi.number().min(0).required().messages({
      "any.required": "سعر التكلفة مطلوب",
      "number.min": "سعر التكلفة لا يمكن أن يكون سالبًا",
    }),
    sellingPrice: joi.number().min(0).required().messages({
      "any.required": "سعر البيع مطلوب",
      "number.min": "سعر البيع لا يمكن أن يكون سالبًا",
    }),
    initialQuantity: joi.number().min(0).optional().messages({
      "number.min": "الكمية الابتدائية لا يمكن أن تكون سالبة",
    }),
    minimumQuantity: joi.number().min(0).optional().messages({
      "number.min": "الحد الأدنى للمخزون لا يمكن أن يكون سالبًا",
    }),
  });

  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return sendError(res, 400, error.details.map((e) => e.message).join(". "));
  }
  next();
});

export const UpdateProductValidation = ErrorCatch(async (req, res, next) => {
  if (req.body.costPrice !== undefined) req.body.costPrice = Number(req.body.costPrice);
  if (req.body.sellingPrice !== undefined) req.body.sellingPrice = Number(req.body.sellingPrice);
  if (req.body.minimumQuantity !== undefined) {
    req.body.minimumQuantity = Number(req.body.minimumQuantity);
  }
  if (req.body.isActive !== undefined) {
    req.body.isActive = req.body.isActive === true || req.body.isActive === "true";
  }

  const schema = joi
    .object({
      sku: joi.string().trim().optional(),
      barcode: joi.string().trim().allow("", null).optional(),
      name: joi.string().trim().optional(),
      description: joi.string().allow("").optional(),
      categoryId: objectId.optional(),
      supplierId: objectId.optional(),
      costPrice: joi.number().min(0).optional(),
      sellingPrice: joi.number().min(0).optional(),
      minimumQuantity: joi.number().min(0).optional(),
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
