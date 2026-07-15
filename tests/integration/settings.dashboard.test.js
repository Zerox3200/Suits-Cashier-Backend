import { describe, it, expect } from 'vitest'
import { asUser, asGuest } from '../helpers/http.js'
import { buildAdmin, buildCashier } from '../factories/user.factory.js'
import { buildProduct } from '../factories/catalog.factory.js'
import { invoicePayload } from '../helpers/payloads.js'
import { Settings } from '../../DB/Settings/Settings.model.js'
import { PAYMENT_METHODS } from '../../src/constants/enums.js'

describe('Settings API', () => {
  describe('GET /settings', () => {
    it('creates defaults on first call and reuses the same singleton on subsequent calls', async () => {
      const { user: cashier } = await buildCashier()

      const first = await asUser(cashier).get('/settings')
      expect(first.status).toBe(200)
      expect(first.body.data.settings).toBeTruthy()
      expect(first.body.data.settings._id).toBeTruthy()
      expect(await Settings.countDocuments()).toBe(1)

      const second = await asUser(cashier).get('/settings')
      expect(second.status).toBe(200)
      // must be the exact same document, not a freshly created one
      expect(second.body.data.settings._id).toBe(first.body.data.settings._id)
      expect(await Settings.countDocuments()).toBe(1)
    })

    it('rejects unauthenticated requests', async () => {
      const res = await asGuest().get('/settings')
      expect(res.status).toBe(401)
    })

    it('returns sane default field values on creation', async () => {
      const { user: cashier } = await buildCashier()
      const res = await asUser(cashier).get('/settings')
      const { settings } = res.body.data

      expect(settings).toMatchObject({
        currency: expect.any(String),
        receiptWidth: expect.stringMatching(/^(58mm|80mm)$/),
        defaultTax: expect.any(Number),
      })
      expect(settings.defaultTax).toBeGreaterThanOrEqual(0)
    })
  })

  describe('PUT /settings', () => {
    it('admin updates receipt width, currency, and store info in a single request', async () => {
      const { user: admin } = await buildAdmin()
      await asUser(admin).get('/settings')

      const res = await asUser(admin)
        .put('/settings')
        .field('storeName', 'محل البدل التجريبي')
        .field('phone', '01000000000')
        .field('address', 'القاهرة')
        .field('currency', 'EGP')
        .field('receiptFooter', 'شكراً')
        .field('receiptWidth', '58mm')
        .field('defaultTax', '14')

      expect(res.status).toBe(200)
      expect(res.body.data.settings).toMatchObject({
        receiptWidth: '58mm',
        storeName: 'محل البدل التجريبي',
        phone: '01000000000',
        address: 'القاهرة',
        currency: 'EGP',
        receiptFooter: 'شكراً',
        defaultTax: 14,
      })

      // persisted, not just echoed back
      const fetched = await asUser(admin).get('/settings')
      expect(fetched.body.data.settings).toMatchObject({
        receiptWidth: '58mm',
        storeName: 'محل البدل التجريبي',
      })
    })

    it('partial update only changes the submitted fields and preserves the rest', async () => {
      const { user: admin } = await buildAdmin()
      await asUser(admin).get('/settings')

      await asUser(admin)
        .put('/settings')
        .field('storeName', 'Original Store')
        .field('currency', 'EGP')
        .field('defaultTax', '10')

      const res = await asUser(admin)
        .put('/settings')
        .field('storeName', 'Renamed Store')

      expect(res.status).toBe(200)
      expect(res.body.data.settings.storeName).toBe('Renamed Store')
      // untouched fields must survive the partial update
      expect(res.body.data.settings.currency).toBe('EGP')
      expect(res.body.data.settings.defaultTax).toBe(10)
    })

    it('rejects invalid receipt width', async () => {
      const { user: admin } = await buildAdmin()
      const res = await asUser(admin).put('/settings').field('receiptWidth', '120mm')
      expect(res.status).toBe(400)
      expect(res.body.message).toBeTruthy()
    })

    it('rejects a negative or out-of-range default tax', async () => {
      const { user: admin } = await buildAdmin()
      const negative = await asUser(admin).put('/settings').field('defaultTax', '-5')
      expect(negative.status).toBe(400)

      const tooHigh = await asUser(admin).put('/settings').field('defaultTax', '150')
      expect(tooHigh.status).toBe(400)
    })

    it('rejects a malformed phone number', async () => {
      const { user: admin } = await buildAdmin()
      const res = await asUser(admin).put('/settings').field('phone', 'not-a-phone')
      expect(res.status).toBe(400)
    })

    it('rejects an unsupported currency code', async () => {
      const { user: admin } = await buildAdmin()
      const res = await asUser(admin).put('/settings').field('currency', 'ZZZ')
      expect(res.status).toBe(400)
    })

    it('forbids a cashier from updating settings', async () => {
      const { user: cashier } = await buildCashier()
      const res = await asUser(cashier).put('/settings').field('storeName', 'Hacked')
      expect(res.status).toBe(403)
    })

    it('rejects unauthenticated update attempts', async () => {
      const res = await asGuest().put('/settings').field('storeName', 'Nope')
      expect(res.status).toBe(401)
    })

    it('does not create a second document when settings do not exist yet and are updated directly', async () => {
      const { user: admin } = await buildAdmin()
      // no prior GET — PUT alone must still uphold the singleton invariant
      const res = await asUser(admin).put('/settings').field('storeName', 'First Write')
      expect(res.status).toBe(200)
      expect(await Settings.countDocuments()).toBe(1)
    })

    it('keeps singleton under concurrent updates and settles on one of the submitted values', async () => {
      const { user: admin } = await buildAdmin()
      await asUser(admin).get('/settings')

      const submitted = ['A', 'B', 'C']
      const responses = await Promise.all(
        submitted.map((name) => asUser(admin).put('/settings').field('storeName', name))
      )

      responses.forEach((res) => expect(res.status).toBe(200))
      expect(await Settings.countDocuments()).toBe(1)

      const final = await asUser(admin).get('/settings')
      // last-write-wins or serialized — either way, must be a value someone actually sent,
      // never a merge/corruption artifact
      expect(submitted).toContain(final.body.data.settings.storeName)
    })
  })
})

describe('Dashboard API', () => {
  const productIdOf = (stockRow) =>
    String(stockRow?.productId?._id || stockRow?.productId || stockRow?._id)

  it('reports zeroed totals when there are no invoices', async () => {
    const { user: admin } = await buildAdmin()
    const res = await asUser(admin).get('/dashboard')

    expect(res.status).toBe(200)
    expect(res.body.data.totalRevenue).toBe(0)
    expect(res.body.data.todaySales).toEqual({ amount: 0, invoiceCount: 0 })
    expect(res.body.data.recentInvoices).toEqual([])
  })

  it('calculates exact revenue and profit from completed invoices only, excluding returned ones', async () => {
    const { user: admin } = await buildAdmin()
    const { user: cashier } = await buildCashier()
    const { product } = await buildProduct({
      sellingPrice: 100,
      costPrice: 40,
      stockQuantity: 100,
    })

    // completed invoice: 2 units -> revenue 200, cost 80, profit 120
    const completed = await asUser(cashier)
      .post('/invoices')
      .send(
        invoicePayload([{ productId: product._id, quantity: 2 }], {
          paymentMethod: PAYMENT_METHODS.CASH,
        })
      )
    expect(completed.status).toBe(201)

    // this invoice gets returned in full and must NOT contribute to revenue/profit
    const returned = await asUser(cashier)
      .post('/invoices')
      .send(invoicePayload([{ productId: product._id, quantity: 1 }]))
    expect(returned.status).toBe(201)

    const returnRes = await asUser(cashier)
      .post(`/invoices/${returned.body.data.invoice._id}/return`)
      .send({ returnReason: 'مرتجع للاختبار' })
    expect(returnRes.status).toBe(200)

    const dash = await asUser(admin).get('/dashboard')
    expect(dash.status).toBe(200)

    // exact values, not just a floor — proves the returned invoice was excluded
    // rather than merely "not double counted"
    expect(dash.body.data.totalRevenue).toBe(200)
    expect(dash.body.data.totalProfit).toBe(120)

    expect(dash.body.data).toMatchObject({
      todaySales: {
        amount: expect.any(Number),
        invoiceCount: expect.any(Number),
      },
      monthlySales: {
        amount: expect.any(Number),
        invoiceCount: expect.any(Number),
      },
      lowStock: {
        count: expect.any(Number),
        products: expect.any(Array),
      },
      outOfStock: {
        count: expect.any(Number),
        products: expect.any(Array),
      },
      recentInvoices: expect.any(Array),
    })

    // the returned invoice must not appear among completed recent invoices
    const recentIds = dash.body.data.recentInvoices.map((inv) => inv._id)
    expect(recentIds).not.toContain(returned.body.data.invoice._id)
  })

  it('flags products at or below their reorder threshold as low stock, and zero-stock as out of stock', async () => {
    const { user: admin } = await buildAdmin()
    const { product: lowStockProduct } = await buildProduct({
      sellingPrice: 50,
      costPrice: 20,
      stockQuantity: 2,
      reorderLevel: 5,
    })
    const { product: outOfStockProduct } = await buildProduct({
      sellingPrice: 50,
      costPrice: 20,
      stockQuantity: 0,
      reorderLevel: 5,
    })
    const { product: healthyProduct } = await buildProduct({
      sellingPrice: 50,
      costPrice: 20,
      stockQuantity: 500,
      reorderLevel: 5,
    })

    const dash = await asUser(admin).get('/dashboard')
    expect(dash.status).toBe(200)

    const lowStockIds = dash.body.data.lowStock.products.map(productIdOf)
    const outOfStockIds = dash.body.data.outOfStock.products.map(productIdOf)

    expect(lowStockIds).toContain(String(lowStockProduct._id))
    expect(outOfStockIds).toContain(String(outOfStockProduct._id))
    expect(lowStockIds).not.toContain(String(healthyProduct._id))
    expect(outOfStockIds).not.toContain(String(healthyProduct._id))
    // a fully depleted product should not simultaneously show up as merely "low"
    expect(lowStockIds).not.toContain(String(outOfStockProduct._id))
  })

  it('forbids a cashier from viewing the dashboard', async () => {
    const { user: cashier } = await buildCashier()
    const res = await asUser(cashier).get('/dashboard')
    expect(res.status).toBe(403)
  })

  it('rejects unauthenticated dashboard requests', async () => {
    const res = await asGuest().get('/dashboard')
    expect(res.status).toBe(401)
  })
})
