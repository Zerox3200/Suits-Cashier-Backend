import { Supplier } from "./Suppliers/Suppliers.model.js";
import { Product } from "./Products/Products.model.js";
import { ActivityLog } from "./ActivityLog/ActivityLog.model.js";
import { ACTIVITY_ENTITIES } from "../src/constants/enums.js";

/**
 * Deletes merchants (Supplier documents) and related activity logs.
 * Also clears product.supplierId so products stay valid.
 *
 * Enable on server start via .env:
 *   RUN_CLEANUP_MERCHANTS=true
 *
 * Turn the flag off after one successful start so data is not wiped again.
 */
export const cleanupMerchants = async (options = {}) => {
  const { dryRun = false } = options;

  const countOrDelete = async (Model, filter, label) => {
    const matched = await Model.countDocuments(filter);
    if (dryRun) {
      console.log(`[cleanup dry-run] Would delete ${matched} ${label}`);
      return { deletedCount: 0, matched };
    }
    const result = await Model.deleteMany(filter);
    console.log(`[cleanup] Deleted ${result.deletedCount} ${label}`);
    return { deletedCount: result.deletedCount, matched };
  };

  console.log(
    dryRun
      ? "[cleanup] DRY RUN — no merchants will be deleted"
      : "[cleanup] Deleting merchants/suppliers (cannot be undone)"
  );

  const linkedProducts = await Product.countDocuments({
    supplierId: { $ne: null },
  });

  if (dryRun) {
    console.log(
      `[cleanup dry-run] Would clear supplierId on ${linkedProducts} product(s)`
    );
  } else {
    const cleared = await Product.updateMany(
      { supplierId: { $ne: null } },
      { $set: { supplierId: null } }
    );
    console.log(
      `[cleanup] Cleared supplierId on ${cleared.modifiedCount} product(s)`
    );
  }

  const summary = {
    merchants: await countOrDelete(Supplier, {}, "merchants (suppliers)"),
    merchantActivityLogs: await countOrDelete(
      ActivityLog,
      { entity: ACTIVITY_ENTITIES.SUPPLIER },
      "merchant activity logs"
    ),
    productsUnlinked: { matched: linkedProducts, deletedCount: 0 },
  };

  return summary;
};

/**
 * Runs cleanup when RUN_CLEANUP_MERCHANTS=true in .env.
 * Safe no-op when the flag is unset/false.
 */
export const runCleanupMerchantsIfEnabled = async () => {
  const enabled = ["1", "true", "yes"].includes(
    String(process.env.RUN_CLEANUP_MERCHANTS || "")
      .trim()
      .toLowerCase()
  );

  if (!enabled) {
    return;
  }

  try {
    await cleanupMerchants();
    console.log(
      "[cleanup] Done. Set RUN_CLEANUP_MERCHANTS=false (or remove it) so this does not run again."
    );
  } catch (error) {
    console.error("[cleanup] Merchants cleanup failed:", error.message);
  }
};
