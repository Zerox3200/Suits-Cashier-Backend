import { describe, it, expect } from 'vitest'
import { asUser } from '../helpers/http.js'
import { buildCashier } from '../factories/user.factory.js'
import { buildProduct } from '../factories/catalog.factory.js'
import { invoicePayload } from '../helpers/payloads.js'

/**
 * Performance smoke tests — run always with small batches.
 * Large stress (1000+) is gated by RUN_STRESS=1 for CI friendliness.
 */
describe('Performance smoke', () => {
  it('creates 10 invoices under 15s', async () => {
    const { user } = await buildCashier()
    const products = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        buildProduct({
          sku: `PERF-${i}`,
          barcode: `PERF-BC-${i}`,
          stockQuantity: 50,
        })
      )
    )

    const started = Date.now()
    for (const { product } of products) {
      const res = await asUser(user)
        .post('/invoices')
        .send(invoicePayload([{ productId: product._id, quantity: 1 }]))
      expect(res.status).toBe(201)
    }
    expect(Date.now() - started).toBeLessThan(15_000)
  })

  it.runIf(process.env.RUN_STRESS === '1')(
    'stress: 1000 invoices sequential',
    async () => {
      const { user } = await buildCashier({ email: 'stress@suits.com' })
      const { product } = await buildProduct({ stockQuantity: 5000 })

      for (let i = 0; i < 1000; i += 1) {
        const res = await asUser(user)
          .post('/invoices')
          .send(invoicePayload([{ productId: product._id, quantity: 1 }]))
        expect(res.status).toBe(201)
      }
    },
    600_000
  )
})
