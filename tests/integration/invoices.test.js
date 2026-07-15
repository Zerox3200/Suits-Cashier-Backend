import { describe, it, expect } from 'vitest'
import { asUser, api } from '../helpers/http.js'
import { buildAdmin, buildCashier } from '../factories/user.factory.js'
import { buildProduct } from '../factories/catalog.factory.js'
import { invoicePayload } from '../helpers/payloads.js'
import { Stock } from '../../DB/Stock/Stock.model.js'
import { StockMovement } from '../../DB/StockMovements/StockMovements.model.js'
import { Invoice } from '../../DB/Invoices/Invoices.model.js'
import { ActivityLog } from '../../DB/ActivityLog/ActivityLog.model.js'
import {
  INVOICE_STATUS,
  PAYMENT_METHODS,
  STOCK_MOVEMENT_TYPE,
  STOCK_MOVEMENT_REASON,
} from '../../src/constants/enums.js'
import { MSG } from '../../src/constants/messages.ar.js'
import { createInvoice } from '../../src/modules/Invoices/invoices.service.js'

describe('Invoices — create', () => {
  it('creates invoice with 1 item, deducts stock, logs activity & movement', async () => {
    const { user: cashier } = await buildCashier()
    const { product, stock } = await buildProduct({
      sellingPrice: 100,
      costPrice: 40,
      stockQuantity: 10,
    })

    const res = await asUser(cashier)
      .post('/invoices')
      .send(invoicePayload([{ productId: product._id, quantity: 2 }], {
        discount: 10,
        tax: 5,
        paymentMethod: PAYMENT_METHODS.CASH,
      }))

    expect(res.status).toBe(201)
    const invoice = res.body.data.invoice
    expect(invoice.subTotal).toBe(200)
    expect(invoice.discount).toBe(10)
    expect(invoice.tax).toBe(5)
    expect(invoice.total).toBe(195)
    expect(invoice.items[0].lineTotal).toBe(200)
    expect(invoice.items[0].unitPrice).toBe(100)
    expect(invoice.items[0].name).toBe(product.name)
    expect(invoice.invoiceNumber).toMatch(/^INV-/)
    expect(invoice.status).toBe(INVOICE_STATUS.COMPLETED)

    const updatedStock = await Stock.findById(stock._id)
    expect(updatedStock.quantity).toBe(8)

    const movements = await StockMovement.find({
      productId: product._id,
      type: STOCK_MOVEMENT_TYPE.OUT,
      reason: STOCK_MOVEMENT_REASON.INVOICE,
    })
    expect(movements).toHaveLength(1)
    expect(movements[0].quantity).toBe(2)

    const logs = await ActivityLog.find({ entityId: invoice._id })
    expect(logs).toHaveLength(1)
  })

  it('merges duplicate product lines into one stock deduction', async () => {
    const { user: cashier } = await buildCashier()
    const { product, stock } = await buildProduct({ stockQuantity: 20 })

    const res = await asUser(cashier)
      .post('/invoices')
      .send(
        invoicePayload([
          { productId: product._id, quantity: 2 },
          { productId: product._id, quantity: 3 },
        ])
      )

    expect(res.status).toBe(201)
    expect(res.body.data.invoice.items).toHaveLength(1)
    expect(res.body.data.invoice.items[0].quantity).toBe(5)
    expect((await Stock.findById(stock._id)).quantity).toBe(15)
  })

  it('rejects out of stock', async () => {
    const { user: cashier } = await buildCashier()
    const { product } = await buildProduct({ stockQuantity: 1 })

    const res = await asUser(cashier)
      .post('/invoices')
      .send(invoicePayload([{ productId: product._id, quantity: 5 }]))

    expect(res.status).toBe(400)
    expect((await Stock.findOne({ productId: product._id })).quantity).toBe(1)
  })

  it('rejects missing items', async () => {
    const { user: cashier } = await buildCashier()
    const res = await asUser(cashier)
      .post('/invoices')
      .send({ items: [], paymentMethod: PAYMENT_METHODS.CASH })
    expect(res.status).toBe(400)
  })

  it('rejects discount greater than subtotal', async () => {
    const { user: cashier } = await buildCashier()
    const { product } = await buildProduct({ sellingPrice: 50, stockQuantity: 5 })

    const res = await asUser(cashier)
      .post('/invoices')
      .send(
        invoicePayload([{ productId: product._id, quantity: 1 }], {
          discount: 999,
        })
      )
    expect(res.status).toBe(400)
    expect(res.body.message).toBe(MSG.DISCOUNT_EXCEEDS)
  })

  it('supports visa payment and zero discount/tax', async () => {
    const { user: cashier } = await buildCashier()
    const { product } = await buildProduct({ stockQuantity: 5 })

    const res = await asUser(cashier)
      .post('/invoices')
      .send(
        invoicePayload([{ productId: product._id, quantity: 1 }], {
          paymentMethod: PAYMENT_METHODS.VISA,
          discount: 0,
          tax: 0,
        })
      )
    expect(res.status).toBe(201)
    expect(res.body.data.invoice.paymentMethod).toBe(PAYMENT_METHODS.VISA)
  })

  it('creates invoice with 100 line items', async () => {
    const { user: cashier } = await buildCashier()
    const catalog = []
    for (let i = 0; i < 100; i += 1) {
      catalog.push(
        await buildProduct({
          sku: `BULK-${i}`,
          barcode: `BULK-BC-${i}`,
          stockQuantity: 5,
          sellingPrice: 10,
        })
      )
    }

    const res = await asUser(cashier)
      .post('/invoices')
      .send(
        invoicePayload(
          catalog.map(({ product }) => ({ productId: product._id, quantity: 1 }))
        )
      )

    expect(res.status).toBe(201)
    expect(res.body.data.invoice.items).toHaveLength(100)
    expect(res.body.data.invoice.subTotal).toBe(1000)
  })

  it('cashier only lists own invoices; admin lists all', async () => {
    const { user: c1 } = await buildCashier({ email: 'c1-inv@suits.com' })
    const { user: c2 } = await buildCashier({ email: 'c2-inv@suits.com' })
    const { user: admin } = await buildAdmin()
    const { product } = await buildProduct({ stockQuantity: 50 })

    await asUser(c1)
      .post('/invoices')
      .send(invoicePayload([{ productId: product._id, quantity: 1 }]))
    await asUser(c2)
      .post('/invoices')
      .send(invoicePayload([{ productId: product._id, quantity: 1 }]))

    const listC1 = await asUser(c1).get('/invoices?limit=50')
    expect(listC1.body.data.items.every((i) => i.createdBy._id === String(c1._id) || i.createdBy === String(c1._id) || String(i.createdBy?._id || i.createdBy) === String(c1._id))).toBe(true)

    const listAdmin = await asUser(admin).get('/invoices?limit=50')
    expect(listAdmin.body.data.items.length).toBeGreaterThanOrEqual(2)
  })

  it('concurrent creates on different products get unique invoice numbers', async () => {
    const { user: cashier } = await buildCashier()
    const products = []
    for (let i = 0; i < 10; i += 1) {
      products.push(
        await buildProduct({
          sku: `CONC-${i}`,
          barcode: `CONC-BC-${i}`,
          stockQuantity: 100,
        })
      )
    }

    const results = await Promise.all(
      products.map(({ product }) =>
        asUser(cashier)
          .post('/invoices')
          .send(invoicePayload([{ productId: product._id, quantity: 1 }]))
      )
    )

    results.forEach((r) => expect(r.status).toBe(201))
    const numbers = results.map((r) => r.body.data.invoice.invoiceNumber)
    expect(new Set(numbers).size).toBe(numbers.length)
  })

  // NEW: the classic overselling race — two concurrent invoices competing
  // for the SAME limited stock. Unlike the test above (different products,
  // no real contention), this actually exercises the DB-level locking /
  // transaction guarantee. Exactly one should win when stock only covers one.
  it('prevents overselling when two concurrent invoices compete for the last unit', async () => {
    const { user: cashier } = await buildCashier()
    const { product, stock } = await buildProduct({ stockQuantity: 1 })

    const [a, b] = await Promise.all([
      asUser(cashier)
        .post('/invoices')
        .send(invoicePayload([{ productId: product._id, quantity: 1 }])),
      asUser(cashier)
        .post('/invoices')
        .send(invoicePayload([{ productId: product._id, quantity: 1 }])),
    ])

    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual([201, 400])

    const finalQty = (await Stock.findById(stock._id)).quantity
    expect(finalQty).toBe(0)
  })

  // NEW: nonexistent / malformed productId shouldn't 500
  it('rejects invoice item referencing nonexistent product', async () => {
    const { user: cashier } = await buildCashier()
    const fakeId = '507f1f77bcf86cd799439011'
    const res = await asUser(cashier)
      .post('/invoices')
      .send(invoicePayload([{ productId: fakeId, quantity: 1 }]))
    expect(res.status).toBe(400)
  })

  it('rejects invoice item with malformed productId', async () => {
    const { user: cashier } = await buildCashier()
    const res = await asUser(cashier)
      .post('/invoices')
      .send(invoicePayload([{ productId: 'not-an-object-id', quantity: 1 }]))
    expect(res.status).toBe(400)
  })

  // NEW: quantity boundary validation
  it('rejects zero quantity line item', async () => {
    const { user: cashier } = await buildCashier()
    const { product } = await buildProduct({ stockQuantity: 5 })
    const res = await asUser(cashier)
      .post('/invoices')
      .send(invoicePayload([{ productId: product._id, quantity: 0 }]))
    expect(res.status).toBe(400)
  })

  it('rejects negative quantity line item', async () => {
    const { user: cashier } = await buildCashier()
    const { product } = await buildProduct({ stockQuantity: 5 })
    const res = await asUser(cashier)
      .post('/invoices')
      .send(invoicePayload([{ productId: product._id, quantity: -1 }]))
    expect(res.status).toBe(400)
  })

  it('rejects non-integer quantity', async () => {
    const { user: cashier } = await buildCashier()
    const { product } = await buildProduct({ stockQuantity: 5 })
    const res = await asUser(cashier)
      .post('/invoices')
      .send(invoicePayload([{ productId: product._id, quantity: 1.5 }]))
    expect(res.status).toBe(400)
  })

  // NEW: negative discount/tax shouldn't be accepted as "free money"
  it('rejects negative discount', async () => {
    const { user: cashier } = await buildCashier()
    const { product } = await buildProduct({ stockQuantity: 5 })
    const res = await asUser(cashier)
      .post('/invoices')
      .send(invoicePayload([{ productId: product._id, quantity: 1 }], { discount: -5 }))
    expect(res.status).toBe(400)
  })

  it('rejects negative tax', async () => {
    const { user: cashier } = await buildCashier()
    const { product } = await buildProduct({ stockQuantity: 5 })
    const res = await asUser(cashier)
      .post('/invoices')
      .send(invoicePayload([{ productId: product._id, quantity: 1 }], { tax: -5 }))
    expect(res.status).toBe(400)
  })

  // NEW: decimal price rounding — confirms the API doesn't drift on
  // floating point math for non-round prices.
  it('handles decimal prices without floating point drift', async () => {
    const { user: cashier } = await buildCashier()
    const { product } = await buildProduct({ sellingPrice: 19.99, stockQuantity: 5 })

    const res = await asUser(cashier)
      .post('/invoices')
      .send(invoicePayload([{ productId: product._id, quantity: 3 }]))

    expect(res.status).toBe(201)
    expect(res.body.data.invoice.subTotal).toBeCloseTo(59.97, 2)
  })

  // NEW: unauthenticated create should be blocked (pattern used elsewhere
  // in the suite, but never verified specifically for this endpoint)
  it('rejects invoice creation without authentication', async () => {
    const { product } = await buildProduct({ stockQuantity: 5 })
    const res = await api()
      .post('/invoices')
      .send(invoicePayload([{ productId: product._id, quantity: 1 }]))
    expect(res.status).toBe(401)
  })

  // NEW: frozen cashier shouldn't be able to create invoices
  it('rejects invoice creation from frozen cashier', async () => {
    const { user: cashier } = await buildCashier({ isFrozen: true })
    const { product } = await buildProduct({ stockQuantity: 5 })
    const res = await asUser(cashier)
      .post('/invoices')
      .send(invoicePayload([{ productId: product._id, quantity: 1 }]))
    expect(res.status).toBe(403)
  })
})

describe('Invoices — read', () => {
  // NEW: single-invoice GET wasn't tested at all before
  it('gets a single invoice by id', async () => {
    const { user: cashier } = await buildCashier()
    const { product } = await buildProduct({ stockQuantity: 5 })
    const created = await asUser(cashier)
      .post('/invoices')
      .send(invoicePayload([{ productId: product._id, quantity: 1 }]))

    const res = await asUser(cashier).get(`/invoices/${created.body.data.invoice._id}`)
    expect(res.status).toBe(200)
    expect(res.body.data.invoice._id).toBe(created.body.data.invoice._id)
  })

  it('returns 404 for nonexistent invoice id', async () => {
    const { user: cashier } = await buildCashier()
    const fakeId = '507f1f77bcf86cd799439011'
    const res = await asUser(cashier).get(`/invoices/${fakeId}`)
    expect(res.status).toBe(404)
  })

  // NEW: cross-cashier read access on a single invoice — the existing test
  // only checked LIST scoping, not detail-route scoping.
  it('blocks a cashier from viewing another cashier\'s invoice by id', async () => {
    const { user: owner } = await buildCashier({ email: 'owner-inv@suits.com' })
    const { user: other } = await buildCashier({ email: 'other-inv@suits.com' })
    const { product } = await buildProduct({ stockQuantity: 5 })

    const created = await asUser(owner)
      .post('/invoices')
      .send(invoicePayload([{ productId: product._id, quantity: 1 }]))

    const res = await asUser(other).get(`/invoices/${created.body.data.invoice._id}`)
    expect(res.status).toBe(403)
  })

  it('admin can view any invoice by id', async () => {
    const { user: cashier } = await buildCashier()
    const { user: admin } = await buildAdmin()
    const { product } = await buildProduct({ stockQuantity: 5 })

    const created = await asUser(cashier)
      .post('/invoices')
      .send(invoicePayload([{ productId: product._id, quantity: 1 }]))

    const res = await asUser(admin).get(`/invoices/${created.body.data.invoice._id}`)
    expect(res.status).toBe(200)
  })
})

describe('Invoices — return', () => {
  it('returns invoice, restores stock, creates IN movement', async () => {
    const { user: cashier } = await buildCashier()
    const { product, stock } = await buildProduct({ stockQuantity: 10 })

    const created = await asUser(cashier)
      .post('/invoices')
      .send(invoicePayload([{ productId: product._id, quantity: 3 }]))
    const id = created.body.data.invoice._id

    const ret = await asUser(cashier)
      .post(`/invoices/${id}/return`)
      .send({ returnReason: 'عميل غير راضٍ' })

    expect(ret.status).toBe(200)
    expect(ret.body.data.invoice.status).toBe(INVOICE_STATUS.RETURNED)
    expect((await Stock.findById(stock._id)).quantity).toBe(10)

    const movements = await StockMovement.find({
      productId: product._id,
      type: STOCK_MOVEMENT_TYPE.IN,
      reason: STOCK_MOVEMENT_REASON.RETURN,
    })
    expect(movements).toHaveLength(1)
    expect(movements[0].quantity).toBe(3)
  })

  it('rejects double return', async () => {
    const { user: cashier } = await buildCashier()
    const { product } = await buildProduct({ stockQuantity: 10 })
    const created = await asUser(cashier)
      .post('/invoices')
      .send(invoicePayload([{ productId: product._id, quantity: 1 }]))
    const id = created.body.data.invoice._id

    await asUser(cashier)
      .post(`/invoices/${id}/return`)
      .send({ returnReason: 'أول إرجاع' })

    const second = await asUser(cashier)
      .post(`/invoices/${id}/return`)
      .send({ returnReason: 'ثاني إرجاع' })

    expect(second.status).toBe(400)
  })

  it('rejects return of missing invoice', async () => {
    const { user: cashier } = await buildCashier()
    const fakeId = '507f1f77bcf86cd799439011'
    const res = await asUser(cashier)
      .post(`/invoices/${fakeId}/return`)
      .send({ returnReason: 'لا يوجد' })
    expect(res.status).toBe(404)
  })

  it('rejects return without reason', async () => {
    const { user: cashier } = await buildCashier()
    const { product } = await buildProduct({ stockQuantity: 5 })
    const created = await asUser(cashier)
      .post('/invoices')
      .send(invoicePayload([{ productId: product._id, quantity: 1 }]))

    const res = await asUser(cashier)
      .post(`/invoices/${created.body.data.invoice._id}/return`)
      .send({})
    expect(res.status).toBe(400)
  })

  // NEW: return-side authorization — creation-side ownership was tested,
  // return-side was not. A cashier returning someone else's invoice is a
  // realistic authorization gap (could be used to manipulate others' stock).
  it('blocks a cashier from returning another cashier\'s invoice', async () => {
    const { user: owner } = await buildCashier({ email: 'owner-ret@suits.com' })
    const { user: other } = await buildCashier({ email: 'other-ret@suits.com' })
    const { product } = await buildProduct({ stockQuantity: 5 })

    const created = await asUser(owner)
      .post('/invoices')
      .send(invoicePayload([{ productId: product._id, quantity: 1 }]))

    const res = await asUser(other)
      .post(`/invoices/${created.body.data.invoice._id}/return`)
      .send({ returnReason: 'محاولة غير مصرح بها' })
    expect(res.status).toBe(403)
  })

  it('admin can return any invoice', async () => {
    const { user: cashier } = await buildCashier()
    const { user: admin } = await buildAdmin()
    const { product } = await buildProduct({ stockQuantity: 5 })

    const created = await asUser(cashier)
      .post('/invoices')
      .send(invoicePayload([{ productId: product._id, quantity: 1 }]))

    const res = await asUser(admin)
      .post(`/invoices/${created.body.data.invoice._id}/return`)
      .send({ returnReason: 'إرجاع من الأدمن' })
    expect(res.status).toBe(200)
  })

  // NEW: empty-string reason should not slip past required-field validation
  it('rejects return with empty string reason', async () => {
    const { user: cashier } = await buildCashier()
    const { product } = await buildProduct({ stockQuantity: 5 })
    const created = await asUser(cashier)
      .post('/invoices')
      .send(invoicePayload([{ productId: product._id, quantity: 1 }]))

    const res = await asUser(cashier)
      .post(`/invoices/${created.body.data.invoice._id}/return`)
      .send({ returnReason: '   ' })
    expect(res.status).toBe(400)
  })
})

describe('Invoices — service transaction integrity', () => {
  it('service createInvoice is atomic for stock on success', async () => {
    const { user: cashier } = await buildCashier()
    const { product } = await buildProduct({ stockQuantity: 5, sellingPrice: 30 })

    const invoice = await createInvoice(
      {
        items: [{ productId: product._id, quantity: 2 }],
        discount: 0,
        tax: 0,
        paymentMethod: PAYMENT_METHODS.CASH,
      },
      cashier._id
    )

    expect(invoice).toBeTruthy()
    expect(await Invoice.countDocuments({ _id: invoice._id })).toBe(1)
    expect((await Stock.findOne({ productId: product._id })).quantity).toBe(3)
  })

  // NEW: failure path atomicity — if the service throws partway through
  // (e.g. one item in a multi-item invoice is out of stock), NOTHING
  // should be persisted: no invoice, no partial stock deduction.
  it('rolls back completely when one item in a multi-item invoice is out of stock', async () => {
    const { user: cashier } = await buildCashier()
    const { product: ok } = await buildProduct({ stockQuantity: 10, sellingPrice: 20 })
    const { product: short } = await buildProduct({ stockQuantity: 1, sellingPrice: 15 })

    await expect(
      createInvoice(
        {
          items: [
            { productId: ok._id, quantity: 2 },
            { productId: short._id, quantity: 5 },
          ],
          discount: 0,
          tax: 0,
          paymentMethod: PAYMENT_METHODS.CASH,
        },
        cashier._id
      )
    ).rejects.toThrow()

    expect((await Stock.findOne({ productId: ok._id })).quantity).toBe(10)
    expect((await Stock.findOne({ productId: short._id })).quantity).toBe(1)
    expect(await Invoice.countDocuments({ createdBy: cashier._id })).toBe(0)
  })
})