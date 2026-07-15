import mongoose from "mongoose";
import {
  STOCK_MOVEMENT_TYPE,
  STOCK_MOVEMENT_REASON,
  STOCK_REFERENCE_TYPE,
} from "../../src/constants/enums.js";

const stockMovementSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    /** Absolute stock before this movement (manual adjustments / audits). */
    previousQuantity: {
      type: Number,
      min: 0,
      default: null,
    },
    /** Absolute stock after this movement. */
    newQuantity: {
      type: Number,
      min: 0,
      default: null,
    },
    type: {
      type: String,
      enum: Object.values(STOCK_MOVEMENT_TYPE),
      required: true,
    },
    reason: {
      type: String,
      enum: Object.values(STOCK_MOVEMENT_REASON),
      required: true,
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    referenceType: {
      type: String,
      enum: Object.values(STOCK_REFERENCE_TYPE),
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export const StockMovement = mongoose.model("StockMovement", stockMovementSchema);
