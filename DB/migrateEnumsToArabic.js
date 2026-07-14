import { User } from "./Users/Users.js";
import { Invoice } from "./Invoices/Invoices.model.js";
import { StockMovement } from "./StockMovements/StockMovements.model.js";
import {
  ROLES,
  INVOICE_STATUS,
  PAYMENT_METHODS,
  STOCK_MOVEMENT_TYPE,
  STOCK_MOVEMENT_REASON,
  STOCK_REFERENCE_TYPE,
} from "../src/constants/enums.js";

/**
 * Migrates legacy English enum values to Arabic (one-time / idempotent).
 */
export const migrateEnumsToArabic = async () => {
  try {
    await Promise.all([
      User.updateMany({ role: "Admin" }, { $set: { role: ROLES.ADMIN } }),
      User.updateMany({ role: "Cashier" }, { $set: { role: ROLES.CASHIER } }),
      User.updateMany({ role: "User" }, { $set: { role: ROLES.CASHIER } }),

      Invoice.updateMany(
        { status: "completed" },
        { $set: { status: INVOICE_STATUS.COMPLETED } }
      ),
      Invoice.updateMany(
        { status: "returned" },
        { $set: { status: INVOICE_STATUS.RETURNED } }
      ),
      Invoice.updateMany(
        { paymentMethod: "Cash" },
        { $set: { paymentMethod: PAYMENT_METHODS.CASH } }
      ),
      Invoice.updateMany(
        { paymentMethod: "Visa" },
        { $set: { paymentMethod: PAYMENT_METHODS.VISA } }
      ),

      StockMovement.updateMany(
        { type: "IN" },
        { $set: { type: STOCK_MOVEMENT_TYPE.IN } }
      ),
      StockMovement.updateMany(
        { type: "OUT" },
        { $set: { type: STOCK_MOVEMENT_TYPE.OUT } }
      ),

      StockMovement.updateMany(
        { reason: "Purchase" },
        { $set: { reason: STOCK_MOVEMENT_REASON.PURCHASE } }
      ),
      StockMovement.updateMany(
        { reason: "Invoice" },
        { $set: { reason: STOCK_MOVEMENT_REASON.INVOICE } }
      ),
      StockMovement.updateMany(
        { reason: "Return" },
        { $set: { reason: STOCK_MOVEMENT_REASON.RETURN } }
      ),
      StockMovement.updateMany(
        { reason: "Manual" },
        { $set: { reason: STOCK_MOVEMENT_REASON.MANUAL } }
      ),
      StockMovement.updateMany(
        { reason: "Damaged" },
        { $set: { reason: STOCK_MOVEMENT_REASON.DAMAGED } }
      ),
      StockMovement.updateMany(
        { reason: "Lost" },
        { $set: { reason: STOCK_MOVEMENT_REASON.LOST } }
      ),
      StockMovement.updateMany(
        { reason: "Correction" },
        { $set: { reason: STOCK_MOVEMENT_REASON.CORRECTION } }
      ),

      StockMovement.updateMany(
        { referenceType: "Invoice" },
        { $set: { referenceType: STOCK_REFERENCE_TYPE.INVOICE } }
      ),
      StockMovement.updateMany(
        { referenceType: "Manual" },
        { $set: { referenceType: STOCK_REFERENCE_TYPE.MANUAL } }
      ),
      StockMovement.updateMany(
        { referenceType: "Purchase" },
        { $set: { referenceType: STOCK_REFERENCE_TYPE.PURCHASE } }
      ),
      StockMovement.updateMany(
        { referenceType: "Adjustment" },
        { $set: { referenceType: STOCK_REFERENCE_TYPE.ADJUSTMENT } }
      ),
    ]);

    console.log("Enum values migrated to Arabic (if any legacy values existed)");
  } catch (error) {
    console.error("Error migrating enum values:", error.message);
  }
};
