import { ErrorCatch } from "../../utils/ErrorCatch.js";
import joi from "joi";
import { sendError } from "../../utils/response.js";
import { MSG } from "../../constants/messages.ar.js";

const objectId = joi.string().hex().length(24).messages({
  "string.hex": "المعرّف غير صالح",
  "string.length": "المعرّف غير صالح",
});

const assertSellingNotBelowCost = (body) => {
  if (
    body.costPrice !== undefined &&
    body.sellingPrice !== undefined &&
    Number(body.sellingPrice) < Number(body.costPrice)
  ) {
    return MSG.SELLING_BELOW_COST;
  }
  return null;
};

export const CreateProductValidation = ErrorCatch(async (req, res, next) => {
  if (req.body.costPrice !== undefined) req.body.costPrice = Number(req.body.costPrice);
  if (req.body.sellingPrice !== undefined) req.body.sellingPrice = Number(req.body.sellingPrice);
  if (req.body.initialQuantity !== undefined) {
    req.body.initialQuantity = Number(req.body.initialQuantity);
  }
  if (req.body.minimumQuantity !== undefined) {
    req.body.minimumQuantity = Number(req.body.minimumQuantity);
  }
  if (typeof req.body.sku === "string") {
    req.body.sku = req.body.sku.trim().toUpperCase();
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
    initialQuantity: joi.number().integer().min(0).optional().messages({
      "number.min": "الكمية الابتدائية لا يمكن أن تكون سالبة",
      "number.integer": "الكمية الابتدائية يجب أن تكون عددًا صحيحًا",
    }),
    minimumQuantity: joi.number().integer().min(0).optional().messages({
      "number.min": "الحد الأدنى للمخزون لا يمكن أن يكون سالبًا",
      "number.integer": "الحد الأدنى للمخزون يجب أن يكون عددًا صحيحًا",
    }),
  });

  const { error, value } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return sendError(res, 400, error.details.map((e) => e.message).join(". "));
  }

  const priceError = assertSellingNotBelowCost(value);
  if (priceError) {
    return sendError(res, 400, priceError);
  }

  req.body = value;
  next();
});

export const ScanProductValidation = ErrorCatch(async (req, res, next) => {
  const schema = joi.object({
    barcode: joi.string().trim().optional(),
    code: joi.string().trim().optional(),
    requireActive: joi.boolean().optional(),
  });

  const { error, value } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return sendError(res, 400, error.details.map((e) => e.message).join(". "));
  }

  const code = (value.barcode || value.code || "").trim();
  if (!code) {
    return sendError(res, 400, "الباركود أو رمز QR مطلوب");
  }

  req.body.barcode = code;
  req.body.requireActive = value.requireActive === true;
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
  if (typeof req.body.sku === "string") {
    req.body.sku = req.body.sku.trim().toUpperCase();
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
      minimumQuantity: joi.number().integer().min(0).optional(),
      isActive: joi.boolean().optional(),
    })
    .min(1)
    .messages({
      "object.min": "يجب إرسال حقل واحد على الأقل للتحديث",
    });

  const { error, value } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return sendError(res, 400, error.details.map((e) => e.message).join(". "));
  }

  const priceError = assertSellingNotBelowCost(value);
  if (priceError) {
    return sendError(res, 400, priceError);
  }

  req.body = value;
  next();
});
