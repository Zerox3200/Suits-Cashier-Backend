import { Category } from '../../DB/Categories/Categories.model.js'
import { Supplier } from '../../DB/Suppliers/Suppliers.model.js'
import { Product } from '../../DB/Products/Products.model.js'
import { Stock } from '../../DB/Stock/Stock.model.js'

let seq = 0

export async function buildCategory(overrides = {}) {
  seq += 1
  return Category.create({
    name: overrides.name || `تصنيف ${seq}`,
    description: overrides.description || '',
    isActive: overrides.isActive ?? true,
    createdBy: overrides.createdBy,
    updatedBy: overrides.updatedBy,
  })
}

export async function buildSupplier(overrides = {}) {
  seq += 1
  return Supplier.create({
    name: overrides.name || `مورد ${seq}`,
    phone: overrides.phone || '01000000000',
    address: overrides.address || 'القاهرة',
    notes: overrides.notes || '',
    isActive: overrides.isActive ?? true,
    createdBy: overrides.createdBy,
    updatedBy: overrides.updatedBy,
  })
}

export async function buildProduct(overrides = {}) {
  seq += 1
  const category = overrides.categoryId
    ? null
    : await buildCategory({ createdBy: overrides.createdBy })
  const supplier = overrides.supplierId
    ? null
    : await buildSupplier({ createdBy: overrides.createdBy })

  const product = await Product.create({
    sku: overrides.sku || `SKU-${seq}-${Date.now()}`,
    barcode: overrides.barcode === '' ? undefined : overrides.barcode || `BC${seq}${Date.now()}`,
    name: overrides.name || `منتج ${seq}`,
    description: overrides.description || '',
    categoryId: overrides.categoryId || category._id,
    supplierId: overrides.supplierId || supplier._id,
    costPrice: overrides.costPrice ?? 50,
    sellingPrice: overrides.sellingPrice ?? 100,
    image: overrides.image || '',
    isActive: overrides.isActive ?? true,
    createdBy: overrides.createdBy,
    updatedBy: overrides.updatedBy,
  })

  const quantity = overrides.stockQuantity ?? 100
  const stock = await Stock.create({
    productId: product._id,
    quantity,
    minimumQuantity:
      overrides.minimumQuantity ?? overrides.reorderLevel ?? 5,
    lastUpdated: new Date(),
  })

  return { product, stock, category: category || null, supplier: supplier || null }
}

export async function buildCatalog(count = 3, overrides = {}) {
  const items = []
  for (let i = 0; i < count; i += 1) {
    items.push(await buildProduct(overrides))
  }
  return items
}
