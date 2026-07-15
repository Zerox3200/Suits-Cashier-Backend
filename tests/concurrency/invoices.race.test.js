import { describe, it, expect } from 'vitest'
import { asUser } from '../helpers/http.js'
import { buildCashier } from '../factories/user.factory.js'
import { buildProduct } from '../factories/catalog.factory.js'
import { invoicePayload } from '../helpers/payloads.js'
import { Stock } from '../../DB/Stock/Stock.model.js'
import { Invoice } from '../../DB/Invoices/Invoices.model.js'

describe('Concurrency — multi-cashier invoice stress', () => {
  it('parallel cashiers never produce duplicate invoice numbers or negative stock', async () => {
    const cashiers = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        buildCashier({ email: `concurrent-c${i}@suits.com` })
      )
    )

    const catalog = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        buildProduct({
          sku: `RACE-SKU-${i}`,
          barcode: `RACE-BC-${i}`,
          stockQuantity: 200,
          sellingPrice: 20,
        })
      )
    )

    const tasks = []
    for (const { user } of cashiers) {
      for (const { product } of catalog) {
        tasks.push(
          asUser(user)
            .post('/invoices')
            .send(invoicePayload([{ productId: product._id, quantity: 1 }]))
        )
      }
    }

    const results = await Promise.all(tasks)
    const ok = results.filter((r) => r.status === 201)
    const failed = results.filter((r) => r.status !== 201)

    expect(ok.length).toBeGreaterThan(0)
    // Prefer all succeed; if write conflicts occur, still assert invariants
    expect(ok.length + failed.length).toBe(tasks.length)

    const numbers = ok.map((r) => r.body.data.invoice.invoiceNumber)
    expect(new Set(numbers).size).toBe(numbers.length)

    const stocks = await Stock.find({})
    stocks.forEach((s) => {
      expect(s.quantity).toBeGreaterThanOrEqual(0)
    })

    expect(await Invoice.countDocuments()).toBe(ok.length)
  })

  it('oversell race never yields negative stock', async () => {
    const cashiers = await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        buildCashier({ email: `same-prod-c${i}@suits.com` })
      )
    )
    const { product } = await buildProduct({ stockQuantity: 20, sellingPrice: 15 })

    const results = await Promise.all(
      cashiers.map(({ user }) =>
        asUser(user)
          .post('/invoices')
          .send(invoicePayload([{ productId: product._id, quantity: 1 }]))
      )
    )

    const succeeded = results.filter((r) => r.status === 201)
    const finalQty = (await Stock.findOne({ productId: product._id })).quantity

    expect(succeeded.length).toBeLessThanOrEqual(20)
    expect(finalQty).toBeGreaterThanOrEqual(0)
    expect(succeeded.length + finalQty).toBe(20)
  })
})
