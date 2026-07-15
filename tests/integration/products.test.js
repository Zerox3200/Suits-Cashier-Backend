import { describe, it, expect } from 'vitest'
import { asUser, asGuest } from '../helpers/http.js'
import { buildAdmin, buildCashier } from '../factories/user.factory.js'
import {
  buildProduct,
  buildCategory,
  buildSupplier,
} from '../factories/catalog.factory.js'
import { ATTACK_STRINGS } from '../helpers/payloads.js'
import { attachProductImage, attachInvalidImage, attachOversizedImage } from '../helpers/images.js'
import { Product } from '../../DB/Products/Products.model.js'
import { Stock } from '../../DB/Stock/Stock.model.js'
import { ActivityLog } from '../../DB/ActivityLog/ActivityLog.model.js'
import { MSG } from '../../src/constants/messages.ar.js'
import { ACTIVITY_ACTIONS } from '../../src/constants/enums.js'

function createProductRequest(client, fields) {
  let req = client.post('/products')
  for (const [k, v] of Object.entries(fields)) {
    req = req.field(k, String(v))
  }
  return attachProductImage(req)
}

// Convenience payload builder so validation-focused tests don't repeat boilerplate.
async function validCreatePayload(admin) {
  const category = await buildCategory({ createdBy: admin._id })
  const supplier = await buildSupplier({ createdBy: admin._id })
  return {
    category,
    supplier,
    fields: {
      sku: `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: 'بدلة كلاسيك',
      categoryId: category._id,
      supplierId: supplier._id,
      costPrice: 80,
      sellingPrice: 150,
      initialQuantity: 25,
      minimumQuantity: 3,
    },
  }
}

describe('Products API', () => {
  describe('create', () => {
    it('creates product with stock and activity log', async () => {
      const { user: admin } = await buildAdmin()
      const category = await buildCategory({ createdBy: admin._id })
      const supplier = await buildSupplier({ createdBy: admin._id })

      const res = await createProductRequest(asUser(admin), {
        sku: 'TEST-SKU-1',
        barcode: '6223001999999',
        name: 'بدلة كلاسيك',
        categoryId: category._id,
        supplierId: supplier._id,
        costPrice: 80,
        sellingPrice: 150,
        initialQuantity: 25,
        minimumQuantity: 3,
      })

      expect(res.status).toBe(201)
      expect(res.body.data.product.sku).toBe('TEST-SKU-1')

      const stock = await Stock.findOne({ productId: res.body.data.product._id })
      expect(stock.quantity).toBe(25)

      const logs = await ActivityLog.find({ entityId: res.body.data.product._id })
      expect(logs.length).toBe(1)
      expect(logs[0].action).toBe(ACTIVITY_ACTIONS.CREATED_PRODUCT)
      expect(String(logs[0].user)).toBe(String(admin._id))
    })

    it('allows cashier to create product', async () => {
      const { user: cashier } = await buildCashier()
      const category = await buildCategory()
      const supplier = await buildSupplier()

      const res = await createProductRequest(asUser(cashier), {
        sku: 'CASHIER-SKU',
        name: 'منتج كاشير',
        categoryId: category._id,
        supplierId: supplier._id,
        costPrice: 10,
        sellingPrice: 20,
        initialQuantity: 5,
      })

      expect(res.status).toBe(201)
    })

    it('rejects unauthenticated create', async () => {
      const category = await buildCategory()
      const supplier = await buildSupplier()

      const res = await createProductRequest(asGuest(), {
        sku: 'NO-AUTH-SKU',
        name: 'No Auth',
        categoryId: category._id,
        supplierId: supplier._id,
        costPrice: 10,
        sellingPrice: 20,
      })

      expect(res.status).toBe(401)
    })

    it('rejects create without image', async () => {
      const { user: admin } = await buildAdmin()
      const category = await buildCategory()
      const supplier = await buildSupplier()

      const res = await asUser(admin)
        .post('/products')
        .field('sku', 'NO-IMG')
        .field('name', 'No Image')
        .field('categoryId', String(category._id))
        .field('supplierId', String(supplier._id))
        .field('costPrice', '10')
        .field('sellingPrice', '20')

      expect(res.status).toBe(400)
      expect(res.body.message).toBe(MSG.PRODUCT_IMAGE_REQUIRED)
    })

    it('rejects image with disallowed mimetype', async () => {
      const { user: admin } = await buildAdmin()
      const { category, supplier, fields } = await validCreatePayload(admin)

      let req = asUser(admin).post('/products')
      for (const [k, v] of Object.entries(fields)) req = req.field(k, String(v))
      const res = await attachInvalidImage(req)

      expect(res.status).toBe(400)
      // Assumption: verify the actual key name in messages.ar.js
      expect(res.body.message).toBe(MSG.INVALID_IMAGE_TYPE)
    })

    it('rejects image exceeding size limit', async () => {
      const { user: admin } = await buildAdmin()
      const { fields } = await validCreatePayload(admin)

      let req = asUser(admin).post('/products')
      for (const [k, v] of Object.entries(fields)) req = req.field(k, String(v))
      const res = await attachOversizedImage(req)

      expect(res.status).toBe(400)
      // Assumption: confirm the size-limit message key and actual configured limit.
      expect(res.body.message).toBe(MSG.IMAGE_TOO_LARGE)
    })

    it('rejects duplicate SKU', async () => {
      const { user: admin } = await buildAdmin()
      const { product } = await buildProduct({ sku: 'DUP-SKU', createdBy: admin._id })
      const category = await buildCategory()
      const supplier = await buildSupplier()

      const res = await createProductRequest(asUser(admin), {
        sku: product.sku,
        name: 'Another',
        categoryId: category._id,
        supplierId: supplier._id,
        costPrice: 1,
        sellingPrice: 2,
      })

      expect(res.status).toBe(400)
      expect(res.body.message).toBe(MSG.SKU_EXISTS)
    })

    it('rejects duplicate SKU regardless of case', async () => {
      const { user: admin } = await buildAdmin()
      const { product } = await buildProduct({ sku: 'CASE-SKU', createdBy: admin._id })
      const category = await buildCategory()
      const supplier = await buildSupplier()

      const res = await createProductRequest(asUser(admin), {
        sku: product.sku.toLowerCase(),
        name: 'Case variant',
        categoryId: category._id,
        supplierId: supplier._id,
        costPrice: 1,
        sellingPrice: 2,
      })

      // Assumption: SKUs are treated case-insensitively. If your schema allows
      // case-sensitive SKUs, delete this test — it will otherwise false-fail.
      expect(res.status).toBe(400)
      expect(res.body.message).toBe(MSG.SKU_EXISTS)
    })

    it('rejects duplicate barcode', async () => {
      const { user: admin } = await buildAdmin()
      await buildProduct({ barcode: 'DUP-BC-001', createdBy: admin._id })
      const category = await buildCategory()
      const supplier = await buildSupplier()

      const res = await createProductRequest(asUser(admin), {
        sku: 'NEW-SKU-BC',
        barcode: 'DUP-BC-001',
        name: 'Dup barcode',
        categoryId: category._id,
        supplierId: supplier._id,
        costPrice: 1,
        sellingPrice: 2,
      })

      expect(res.status).toBe(400)
      expect(res.body.message).toBe(MSG.BARCODE_EXISTS)
    })

    it('rejects inactive category', async () => {
      const { user: admin } = await buildAdmin()
      const category = await buildCategory({ isActive: false })
      const supplier = await buildSupplier()

      const res = await createProductRequest(asUser(admin), {
        sku: 'INACTIVE-CAT',
        name: 'Bad cat',
        categoryId: category._id,
        supplierId: supplier._id,
        costPrice: 1,
        sellingPrice: 2,
      })

      expect(res.status).toBe(400)
      expect(res.body.message).toBe(MSG.CATEGORY_INACTIVE)
    })

    it('rejects inactive supplier', async () => {
      const { user: admin } = await buildAdmin()
      const category = await buildCategory()
      const supplier = await buildSupplier({ isActive: false })

      const res = await createProductRequest(asUser(admin), {
        sku: 'INACTIVE-SUP',
        name: 'Bad supplier',
        categoryId: category._id,
        supplierId: supplier._id,
        costPrice: 1,
        sellingPrice: 2,
      })

      expect(res.status).toBe(400)
      // Assumption: mirrors CATEGORY_INACTIVE — confirm the key exists.
      expect(res.body.message).toBe(MSG.SUPPLIER_INACTIVE)
    })

    it('rejects nonexistent categoryId', async () => {
      const { user: admin } = await buildAdmin()
      const supplier = await buildSupplier()
      const fakeCategoryId = '507f1f77bcf86cd799439011'

      const res = await createProductRequest(asUser(admin), {
        sku: 'NO-CAT',
        name: 'No category',
        categoryId: fakeCategoryId,
        supplierId: supplier._id,
        costPrice: 1,
        sellingPrice: 2,
      })

      expect(res.status).toBe(400)
    })

    it('rejects malformed categoryId', async () => {
      const { user: admin } = await buildAdmin()
      const supplier = await buildSupplier()

      const res = await createProductRequest(asUser(admin), {
        sku: 'BAD-ID',
        name: 'Bad id',
        categoryId: 'not-an-object-id',
        supplierId: supplier._id,
        costPrice: 1,
        sellingPrice: 2,
      })

      expect(res.status).toBe(400)
    })

    it('rejects missing required fields', async () => {
      const { user: admin } = await buildAdmin()
      const category = await buildCategory()
      const supplier = await buildSupplier()

      for (const omit of ['name', 'categoryId', 'supplierId', 'sku']) {
        const fields = {
          sku: 'REQ-FIELDS',
          name: 'Required check',
          categoryId: category._id,
          supplierId: supplier._id,
          costPrice: 1,
          sellingPrice: 2,
        }
        delete fields[omit]

        const res = await createProductRequest(asUser(admin), fields)
        expect(res.status, `expected 400 when omitting "${omit}"`).toBe(400)
      }
    })

    it('rejects negative prices via validation', async () => {
      const { user: admin } = await buildAdmin()
      const category = await buildCategory()
      const supplier = await buildSupplier()

      const res = await createProductRequest(asUser(admin), {
        sku: 'NEG-PRICE',
        name: 'Neg',
        categoryId: category._id,
        supplierId: supplier._id,
        costPrice: -5,
        sellingPrice: 10,
      })

      expect(res.status).toBe(400)
    })

    it('rejects selling price below cost price', async () => {
      const { user: admin } = await buildAdmin()
      const category = await buildCategory()
      const supplier = await buildSupplier()

      const res = await createProductRequest(asUser(admin), {
        sku: 'LOSS-PRICE',
        name: 'Underpriced',
        categoryId: category._id,
        supplierId: supplier._id,
        costPrice: 100,
        sellingPrice: 50,
      })

      // Assumption: this business rule may not actually be enforced server-side.
      // If margin can legitimately be negative (e.g. clearance pricing), remove this test.
      expect(res.status).toBe(400)
    })

    it('rejects negative or non-integer initialQuantity', async () => {
      const { user: admin } = await buildAdmin()
      const category = await buildCategory()
      const supplier = await buildSupplier()

      for (const qty of [-1, 1.5]) {
        const res = await createProductRequest(asUser(admin), {
          sku: `QTY-${qty}`,
          name: 'Qty check',
          categoryId: category._id,
          supplierId: supplier._id,
          costPrice: 10,
          sellingPrice: 20,
          initialQuantity: qty,
        })
        expect(res.status, `expected 400 for initialQuantity=${qty}`).toBe(400)
      }
    })

    it('accepts Arabic, unicode, and emoji names', async () => {
      const { user: admin } = await buildAdmin()
      const category = await buildCategory()
      const supplier = await buildSupplier()

      for (const [sku, name] of [
        ['AR-1', 'بدلة رجالي'],
        ['UNI-1', ATTACK_STRINGS.unicode],
        ['EMO-1', ATTACK_STRINGS.emoji],
      ]) {
        const res = await createProductRequest(asUser(admin), {
          sku,
          name,
          categoryId: category._id,
          supplierId: supplier._id,
          costPrice: 10,
          sellingPrice: 20,
        })
        expect(res.status).toBe(201)
        expect(res.body.data.product.name).toBe(name)
      }
    })

    it('stores XSS-looking names as plain data', async () => {
      const { user: admin } = await buildAdmin()
      const category = await buildCategory()
      const supplier = await buildSupplier()

      const res = await createProductRequest(asUser(admin), {
        sku: 'XSS-1',
        name: ATTACK_STRINGS.xss,
        categoryId: category._id,
        supplierId: supplier._id,
        costPrice: 10,
        sellingPrice: 20,
      })

      expect(res.status).toBe(201)
      expect(res.body.data.product.name).toBe(ATTACK_STRINGS.xss)
    })

    it('handles parallel identical creates — only one SKU wins', async () => {
      const { user: admin } = await buildAdmin()
      const category = await buildCategory()
      const supplier = await buildSupplier()
      const client = asUser(admin)

      const payload = {
        sku: 'PARALLEL-SKU',
        name: 'Parallel',
        categoryId: category._id,
        supplierId: supplier._id,
        costPrice: 10,
        sellingPrice: 20,
      }

      const results = await Promise.all([
        createProductRequest(client, payload),
        createProductRequest(client, payload),
        createProductRequest(client, payload),
      ])

      const ok = results.filter((r) => r.status === 201)
      const fail = results.filter((r) => r.status >= 400)
      expect(ok.length).toBe(1)
      expect(fail.length).toBe(2)

      // The winning record should be the only one persisted, and stock/logs
      // should reflect exactly one creation — not partial writes from the losers.
      const persisted = await Product.find({ sku: 'PARALLEL-SKU' })
      expect(persisted.length).toBe(1)
      const stock = await Stock.findOne({ productId: persisted[0]._id })
      expect(stock).not.toBeNull()
      const logs = await ActivityLog.find({ entityId: persisted[0]._id })
      expect(logs.length).toBe(1)
    })
  })

  describe('read', () => {
    it('searches and paginates products', async () => {
      const { user: admin } = await buildAdmin()
      await buildProduct({ name: 'Navy Suit Alpha', createdBy: admin._id })
      await buildProduct({ name: 'Gray Jacket', createdBy: admin._id })

      const res = await asUser(admin).get('/products?search=Navy&limit=10')
      expect(res.status).toBe(200)
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1)
      expect(
        res.body.data.items.every((p) => p.name.includes('Navy'))
      ).toBe(true)
    })

    it('escapes regex special characters in search', async () => {
      const { user: admin } = await buildAdmin()
      await buildProduct({ name: 'Suit (Premium)', createdBy: admin._id })

      // A naive, unescaped regex would treat "(" as a group-start and 500 or
      // silently match everything; this should either match literally or
      // return zero results — never error.
      const res = await asUser(admin).get(
        `/products?search=${encodeURIComponent('(Premium)')}`
      )
      expect(res.status).toBe(200)
      expect(res.body.data.items.some((p) => p.name === 'Suit (Premium)')).toBe(
        true
      )
    })

    it('returns an empty page beyond available results', async () => {
      const { user: admin } = await buildAdmin()
      await buildProduct({ createdBy: admin._id })

      const res = await asUser(admin).get('/products?page=999&limit=10')
      expect(res.status).toBe(200)
      expect(res.body.data.items).toEqual([])
    })

    it('rejects invalid pagination params gracefully', async () => {
      const { user: admin } = await buildAdmin()

      const res = await asUser(admin).get('/products?page=-1&limit=0')
      // Assumption: server clamps rather than 400s — adjust to whichever your
      // validation layer actually does.
      expect([200, 400]).toContain(res.status)
    })

    it('cashiers only see active products by default', async () => {
      const { user: admin } = await buildAdmin()
      const { user: cashier } = await buildCashier()
      await buildProduct({ name: 'Active One', isActive: true, createdBy: admin._id })
      await buildProduct({
        name: 'Inactive One',
        isActive: false,
        createdBy: admin._id,
      })

      const res = await asUser(cashier).get('/products?limit=50')
      expect(res.status).toBe(200)
      expect(res.body.data.items.some((p) => p.name === 'Inactive One')).toBe(
        false
      )
    })

    it('admin can include inactive products with a filter flag', async () => {
      const { user: admin } = await buildAdmin()
      await buildProduct({ name: 'Hidden Item', isActive: false, createdBy: admin._id })

      // Assumption: query flag name — adjust to match your actual API contract.
      const res = await asUser(admin).get('/products?includeInactive=true&limit=50')
      expect(res.status).toBe(200)
      expect(res.body.data.items.some((p) => p.name === 'Hidden Item')).toBe(true)
    })

    it('returns 404 for a nonexistent product id', async () => {
      const { user: admin } = await buildAdmin()
      const res = await asUser(admin).get('/products/507f1f77bcf86cd799439011')
      expect(res.status).toBe(404)
    })

    it('scans product by barcode then sku', async () => {
      const { user: cashier } = await buildCashier()
      const { product } = await buildProduct({
        barcode: 'SCAN-BC-77',
        sku: 'SCAN-SKU-77',
      })

      const byBarcode = await asUser(cashier)
        .post('/products/scan')
        .send({ barcode: 'SCAN-BC-77' })
      expect(byBarcode.status).toBe(200)
      expect(byBarcode.body.data.product._id).toBe(String(product._id))

      const bySku = await asUser(cashier)
        .post('/products/scan')
        .send({ barcode: 'SCAN-SKU-77' })
      expect(bySku.status).toBe(200)
      expect(bySku.body.data.product._id).toBe(String(product._id))
    })

    it('returns 404 when scanning an unknown code', async () => {
      const { user: cashier } = await buildCashier()

      const res = await asUser(cashier)
        .post('/products/scan')
        .send({ barcode: 'DOES-NOT-EXIST' })

      expect(res.status).toBe(404)
    })
  })

  describe('update / lifecycle', () => {
    it('updates product', async () => {
      const { user: admin } = await buildAdmin()
      const { product } = await buildProduct({ createdBy: admin._id })

      const res = await asUser(admin)
        .put(`/products/${product._id}`)
        .field('name', 'Updated Name')
        .field('sku', product.sku)
        .field('costPrice', String(product.costPrice))
        .field('sellingPrice', String(product.sellingPrice))
        .field('categoryId', String(product.categoryId))
        .field('supplierId', String(product.supplierId))

      expect(res.status).toBe(200)
      expect(res.body.data.product.name).toBe('Updated Name')

      const logs = await ActivityLog.find({ entityId: product._id })
      expect(logs.some((l) => l.action === ACTIVITY_ACTIONS.UPDATED_PRODUCT)).toBe(true)
    })

    it('returns 404 updating a nonexistent product', async () => {
      const { user: admin } = await buildAdmin()

      const res = await asUser(admin)
        .put('/products/507f1f77bcf86cd799439011')
        .field('name', 'Ghost')

      expect(res.status).toBe(404)
    })

    it('rejects update that collides with another product SKU', async () => {
      const { user: admin } = await buildAdmin()
      const { product: existing } = await buildProduct({ sku: 'TAKEN-SKU', createdBy: admin._id })
      const { product: target } = await buildProduct({ createdBy: admin._id })

      const res = await asUser(admin)
        .put(`/products/${target._id}`)
        .field('sku', existing.sku)
        .field('name', target.name)
        .field('costPrice', String(target.costPrice))
        .field('sellingPrice', String(target.sellingPrice))
        .field('categoryId', String(target.categoryId))
        .field('supplierId', String(target.supplierId))

      expect(res.status).toBe(400)
      expect(res.body.message).toBe(MSG.SKU_EXISTS)
    })

    it('admin can deactivate then restore', async () => {
      const { user: admin } = await buildAdmin()
      const { product } = await buildProduct({ createdBy: admin._id })

      const off = await asUser(admin).patch(`/products/${product._id}/deactivate`)
      expect(off.status).toBe(200)
      expect((await Product.findById(product._id)).isActive).toBe(false)

      const on = await asUser(admin).patch(`/products/${product._id}/restore`)
      expect(on.status).toBe(200)
      expect((await Product.findById(product._id)).isActive).toBe(true)

      const logs = await ActivityLog.find({ entityId: product._id })
      expect(logs.some((l) => l.action === ACTIVITY_ACTIONS.DEACTIVATED_PRODUCT)).toBe(true)
      expect(logs.some((l) => l.action === ACTIVITY_ACTIONS.RESTORED_PRODUCT)).toBe(true)
    })

    it('deactivating an already-inactive product is idempotent', async () => {
      const { user: admin } = await buildAdmin()
      const { product } = await buildProduct({ createdBy: admin._id, isActive: false })

      const res = await asUser(admin).patch(`/products/${product._id}/deactivate`)
      // Assumption: idempotent 200 rather than a conflict error — adjust if
      // your API treats re-deactivation as a 400/409.
      expect(res.status).toBe(200)
      expect((await Product.findById(product._id)).isActive).toBe(false)
    })

    it('cashier cannot deactivate a product', async () => {
      const { user: cashier } = await buildCashier()
      const { product } = await buildProduct()

      const res = await asUser(cashier).patch(`/products/${product._id}/deactivate`)

      // Assumption: deactivate/restore are admin-only actions. Verify against
      // your actual role-based access rules — remove if cashiers are permitted.
      expect(res.status).toBe(403)
      expect((await Product.findById(product._id)).isActive).toBe(true)
    })

    it('returns 404 deactivating a nonexistent product', async () => {
      const { user: admin } = await buildAdmin()
      const res = await asUser(admin).patch('/products/507f1f77bcf86cd799439011/deactivate')
      expect(res.status).toBe(404)
    })
  })
})