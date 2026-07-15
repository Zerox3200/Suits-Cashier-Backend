import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
  {
    storeName: { type: String, default: "" },
    logo: { type: String, default: "" },
    phone: { type: String, default: "" },
    address: { type: String, default: "" },
    currency: { type: String, default: "EGP" },
    defaultTax: { type: Number, default: 0, min: 0 },
    receiptFooter: { type: String, default: "" },
    /** Thermal paper width for browser print: "58mm" | "80mm" */
    receiptWidth: {
      type: String,
      enum: ["58mm", "80mm"],
      default: "80mm",
    },
    /** Optional fields for future receipt extras */
    taxNumber: { type: String, default: "" },
    companyRegNumber: { type: String, default: "" },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export const Settings = mongoose.model("Settings", settingsSchema);
