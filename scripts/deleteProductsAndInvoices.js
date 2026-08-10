/**
 * Destructive cleanup: delete products and/or invoices (and related stock data).
 *
 * Usage (on the server, from project root):
 *   node scripts/deleteProductsAndInvoices.js --dry-run
 *   node scripts/deleteProductsAndInvoices.js --confirm
 *   node scripts/deleteProductsAndInvoices.js --confirm --products-only
 *   node scripts/deleteProductsAndInvoices.js --confirm --invoices-only
 *
 * Requires MONGODB_URI in .env (or defaults to mongodb://127.0.0.1:27017/Suits-app).
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { conn } from "../DB/connection.js";
import { Product } from "../DB/Products/Products.model.js";
import { Invoice } from "../DB/Invoices/Invoices.model.js";
import { Stock } from "../DB/Stock/Stock.model.js";
import { StockMovement } from "../DB/StockMovements/StockMovements.model.js";
import { ActivityLog } from "../DB/ActivityLog/ActivityLog.model.js";
import {
  ACTIVITY_ENTITIES,
  STOCK_REFERENCE_TYPE,
} from "../src/constants/enums.js";

dotenv.config();

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || !args.has("--confirm");
const productsOnly = args.has("--products-only");
const invoicesOnly = args.has("--invoices-only");

if (productsOnly && invoicesOnly) {
  console.error("Use either --products-only or --invoices-only, not both.");
  process.exit(1);
}

const deleteProducts = !invoicesOnly;
const deleteInvoices = !productsOnly;

const countOrDelete = async (Model, filter, label) => {
  const count = await Model.countDocuments(filter);
  if (dryRun) {
    console.log(`[dry-run] Would delete ${count} ${label}`);
    return { deletedCount: 0, matched: count };
  }
  const result = await Model.deleteMany(filter);
  console.log(`Deleted ${result.deletedCount} ${label}`);
  return { deletedCount: result.deletedCount, matched: count };
};

const run = async () => {
  await conn();

  console.log(
    dryRun
      ? "\n=== DRY RUN (no data will be deleted). Pass --confirm to delete. ===\n"
      : "\n=== DELETING DATA — this cannot be undone ===\n"
  );
  console.log(`MongoDB: ${process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/Suits-app"}`);
  console.log(
    `Targets: ${[
      deleteProducts && "products (+ stock, product stock movements, product activity logs)",
      deleteInvoices && "invoices (+ invoice stock movements, invoice activity logs)",
    ]
      .filter(Boolean)
      .join("; ")}\n`
  );

  const summary = {};

  if (deleteInvoices) {
    summary.invoices = await countOrDelete(Invoice, {}, "invoices");
    // Only clear invoice movements here when products are kept
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
    // Products gone → clear all stock movements (invoice-linked ones are orphaned otherwise)
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

  console.log("\nSummary:");
  for (const [key, value] of Object.entries(summary)) {
    console.log(
      `  ${key}: ${dryRun ? `would delete ${value.matched}` : `deleted ${value.deletedCount}`}`
    );
  }

  if (dryRun) {
    console.log("\nRe-run with --confirm to apply deletions.");
  } else {
    console.log("\nDone.");
  }
};

run()
  .catch((err) => {
    console.error("Cleanup failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
