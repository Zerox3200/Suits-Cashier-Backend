/**
 * Destructive cleanup: delete products and/or invoices (and related stock data).
 *
 * Usage (from project root):
 *   node scripts/deleteProductsAndInvoices.js --dry-run
 *   node scripts/deleteProductsAndInvoices.js --confirm
 *   node scripts/deleteProductsAndInvoices.js --confirm --products-only
 *   node scripts/deleteProductsAndInvoices.js --confirm --invoices-only
 *
 * Or enable once on server start in .env:
 *   RUN_CLEANUP_PRODUCTS_INVOICES=true
 *   CLEANUP_TARGET=all
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { conn } from "../DB/connection.js";
import { cleanupProductsAndInvoices } from "../DB/cleanupProductsAndInvoices.js";

dotenv.config();

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || !args.has("--confirm");
const productsOnly = args.has("--products-only");
const invoicesOnly = args.has("--invoices-only");

if (productsOnly && invoicesOnly) {
  console.error("Use either --products-only or --invoices-only, not both.");
  process.exit(1);
}

const run = async () => {
  await conn();

  console.log(
    `\nMongoDB: ${process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/Suits-app"}\n`
  );

  await cleanupProductsAndInvoices({
    deleteProducts: !invoicesOnly,
    deleteInvoices: !productsOnly,
    dryRun,
  });

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
