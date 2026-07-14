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
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export const Settings = mongoose.model("Settings", settingsSchema);
