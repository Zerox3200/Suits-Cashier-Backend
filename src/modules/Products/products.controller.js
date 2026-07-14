import { ErrorCatch } from "../../utils/ErrorCatch.js";
import { sendSuccess, sendError } from "../../utils/response.js";
import { getSingleImage } from "../../utils/multer.js";
import {
  createProduct,
  listProducts,
  getProductById,
  updateProduct,
  deactivateProduct,
  restoreProduct,
} from "./products.service.js";
import { adjustStock } from "../Stock/stock.service.js";
import { MSG } from "../../constants/messages.ar.js";

export const CreateProduct = ErrorCatch(async (req, res) => {
  const imageData = getSingleImage(req, "image");
  if (!imageData?.path) {
    return sendError(res, 400, MSG.PRODUCT_IMAGE_REQUIRED);
  }

  const product = await createProduct(req.body, imageData, req.user._id);
  return sendSuccess(res, 201, MSG.PRODUCT_CREATED, { product });
});

export const GetProducts = ErrorCatch(async (req, res) => {
  const data = await listProducts(req.query, req.user);
  return sendSuccess(res, 200, MSG.PRODUCTS_RETRIEVED, data);
});

export const GetProduct = ErrorCatch(async (req, res) => {
  const data = await getProductById(req.params.id);
  return sendSuccess(res, 200, MSG.PRODUCT_RETRIEVED, data);
});

export const UpdateProduct = ErrorCatch(async (req, res) => {
  const imageData = req.file ? getSingleImage(req, "image") : null;
  const product = await updateProduct(req.params.id, req.body, imageData, req.user._id);
  return sendSuccess(res, 200, MSG.PRODUCT_UPDATED, { product });
});

export const UpdateProductStock = ErrorCatch(async (req, res) => {
  const stock = await adjustStock(req.params.id, req.body, req.user._id);
  return sendSuccess(res, 200, MSG.STOCK_ADJUSTED, { stock });
});

export const DeactivateProduct = ErrorCatch(async (req, res) => {
  const product = await deactivateProduct(req.params.id, req.user._id);
  return sendSuccess(res, 200, MSG.PRODUCT_DEACTIVATED, { product });
});

export const RestoreProduct = ErrorCatch(async (req, res) => {
  const product = await restoreProduct(req.params.id, req.user._id);
  return sendSuccess(res, 200, MSG.PRODUCT_RESTORED, { product });
});
