import { Product } from "./Products/Products.model.js";

/**
 * Clears empty-string barcodes and replaces the unique index so "" no longer causes E11000.
 */
export const migrateProductBarcodes = async () => {
  try {
    // Drop old unique/sparse barcode indexes that indexed empty strings
    const indexes = await Product.collection.indexes();
    for (const idx of indexes) {
      if (idx.name === "barcode_1") {
        await Product.collection.dropIndex("barcode_1");
        console.log("Dropped legacy products.barcode_1 index");
      }
    }

    const result = await Product.updateMany(
      { $or: [{ barcode: "" }, { barcode: null }] },
      { $unset: { barcode: 1 } }
    );

    if (result.modifiedCount > 0) {
      console.log(`Cleared empty barcode on ${result.modifiedCount} product(s)`);
    }

    // Recreate schema indexes (partial unique on non-empty barcode)
    await Product.syncIndexes();
    console.log("Product barcode indexes synced");
  } catch (error) {
    console.error("Error migrating product barcodes:", error.message);
  }
};
