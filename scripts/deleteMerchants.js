/**
 * Destructive cleanup: delete merchants (suppliers) and related activity logs.
 *
 * Usage (from project root):
 *   node scripts/deleteMerchants.js --dry-run
 *   node scripts/deleteMerchants.js --confirm
 *
 * Or enable once on server start in .env:
 *   RUN_CLEANUP_MERCHANTS=true
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import { conn } from "../DB/connection.js";
import { cleanupMerchants } from "../DB/cleanupMerchants.js";

dotenv.config();

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || !args.has("--confirm");

const run = async () => {
  await conn();

  console.log(
    `\nMongoDB: ${process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/Suits-app"}\n`
  );

  await cleanupMerchants({ dryRun });

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
