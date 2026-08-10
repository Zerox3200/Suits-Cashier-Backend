import { Product } from "./Products/Products.model.js";
import { Invoice } from "./Invoices/Invoices.model.js";
import { Stock } from "./Stock/Stock.model.js";
import { StockMovement } from "./StockMovements/StockMovements.model.js";
import { ActivityLog } from "./ActivityLog/ActivityLog.model.js";
import {
  ACTIVITY_ENTITIES,
  STOCK_REFERENCE_TYPE,
} from "../src/constants/enums.js";

/**
 * Deletes products and/or invoices and related stock / activity data.
 *
 * Enable on server start via .env:
 *   RUN_CLEANUP_PRODUCTS_INVOICES=true
 * Optional:
 *   CLEANUP_TARGET=all|products|invoices   (default: all)
 *
 * Turn the flag off after one successful start so data is not wiped again.
 */
export const cleanupProductsAndInvoices = async (options = {}) => {
  const {
    deleteProducts = true,
    deleteInvoices = true,
    dryRun = false,
  } = options;

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
      ? "[cleanup] DRY RUN — no data will be deleted"
      : "[cleanup] Deleting products/invoices (cannot be undone)"
  );

  const summary = {};

  if (deleteInvoices) {
    summary.invoices = await countOrDelete(Invoice, {}, "invoices");
    if (!deleteProducts) {
      summary.invoiceStockMovements = await countOrDelete(
        StockMovement,
        { referenceType: STOCK_REFERENCE_TYPE.INVOICE },
        "invoice stock movements"
      );
    }
    summary.invoiceActivityLogs = await countOrDelete(
      ActivityLog,
      { entity: ACTIVITY_ENTITIES.INVOICE },
      "invoice activity logs"
    );
  }

  if (deleteProducts) {
    summary.products = await countOrDelete(Product, {}, "products");
    summary.stock = await countOrDelete(Stock, {}, "stock records");
    summary.stockMovements = await countOrDelete(
      StockMovement,
      {},
      "stock movements"
    );
    summary.productActivityLogs = await countOrDelete(
      ActivityLog,
      {
        entity: {
          $in: [ACTIVITY_ENTITIES.PRODUCT, ACTIVITY_ENTITIES.STOCK],
        },
      },
      "product/stock activity logs"
    );
  }

  return summary;
};

/**
 * Runs cleanup when RUN_CLEANUP_PRODUCTS_INVOICES=true in .env.
 * Safe no-op when the flag is unset/false.
 */
export const runCleanupProductsAndInvoicesIfEnabled = async () => {
  const enabled = ["1", "true", "yes"].includes(
    String(process.env.RUN_CLEANUP_PRODUCTS_INVOICES || "")
      .trim()
      .toLowerCase()
  );

  if (!enabled) {
    return;
  }

  const target = String(process.env.CLEANUP_TARGET || "all")
    .trim()
    .toLowerCase();

  const deleteProducts = target === "all" || target === "products";
  const deleteInvoices = target === "all" || target === "invoices";

  if (!deleteProducts && !deleteInvoices) {
    console.warn(
      `[cleanup] Invalid CLEANUP_TARGET="${target}" (use all|products|invoices). Skipping.`
    );
    return;
  }

  try {
    await cleanupProductsAndInvoices({ deleteProducts, deleteInvoices });
    console.log(
      "[cleanup] Done. Set RUN_CLEANUP_PRODUCTS_INVOICES=false (or remove it) so this does not run again."
    );
  } catch (error) {
    console.error("[cleanup] Failed:", error.message);
  }
};
