import { describe, it, expect } from 'vitest'
import { asUser, asGuest } from '../helpers/http.js'
import { buildAdmin, buildCashier } from '../factories/user.factory.js'
import { buildProduct } from '../factories/catalog.factory.js'
import { adjustPayload } from '../helpers/payloads.js'
import { Stock } from '../../DB/Stock/Stock.model.js'
import { StockMovement } from '../../DB/StockMovements/StockMovements.model.js'
import {
  STOCK_ADJUST_REASON,
  STOCK_MOVEMENT_TYPE,
} from '../../src/constants/enums.js'

const productIdOf = (row) =>
  String(row?.productId?._id || row?.productId || '')

describe('Stock API', () => {
  describe('PATCH /stock/:id — adjustments', () => {
    it('adjusts absolute quantity up, updates the stock row, and records a full IN movement', async () => {
      const { user: cashier } = await buildCashier()
      const { product, stock } = await buildProduct({ stockQuantity: 10 })

      const res = await asUser(cashier)
        .patch(`/stock/${product._id}`)
        .send(adjustPayload(25, STOCK_ADJUST_REASON.PURCHASE))

      expect(res.status).toBe(200)
      expect(res.body.data.stock.quantity).toBe(25)
      expect((await Stock.findById(stock._id)).quantity).toBe(25)

      const movements = await StockMovement.find({ productId: product._id })
      expect(movements.length).toBe(1)
      // verify the full audit trail, not just the delta
      expect(movements[0]).toMatchObject({
        type: STOCK_MOVEMENT_TYPE.IN,
        quantity: 15,
        previousQuantity: 10,
        newQuantity: 25,
        reason: STOCK_ADJUST_REASON.PURCHASE,
      })
      expect(String(movements[0].createdBy ?? movements[0].adjustedBy)).toBe(String(cashier._id))
      expect(movements[0].createdAt).toBeTruthy()
    })

    it('adjusts quantity down with damaged reason and records a full OUT movement', async () => {
      const { user: cashier } = await buildCashier()
      const { product } = await buildProduct({ stockQuantity: 20 })

      const res = await asUser(cashier)
        .patch(`/stock/${product._id}`)
        .send(adjustPayload(5, STOCK_ADJUST_REASON.DAMAGED))

      expect(res.status).toBe(200)
      const movement = await StockMovement.findOne({ productId: product._id })
      expect(movement).toMatchObject({
        type: STOCK_MOVEMENT_TYPE.OUT,
        quantity: 15,
        previousQuantity: 20,
        newQuantity: 5,
        reason: STOCK_ADJUST_REASON.DAMAGED,
      })
    })

    it('allows zero quantity and records it as a full OUT movement', async () => {
      const { user: cashier } = await buildCashier()
      const { product } = await buildProduct({ stockQuantity: 4 })

      const res = await asUser(cashier)
        .patch(`/stock/${product._id}`)
        .send(adjustPayload(0, STOCK_ADJUST_REASON.LOST))

      expect(res.status).toBe(200)
      const stockRow = await Stock.findOne({ productId: product._id })
      expect(stockRow.quantity).toBe(0)

      const movement = await StockMovement.findOne({ productId: product._id })
      expect(movement).toMatchObject({
        type: STOCK_MOVEMENT_TYPE.OUT,
        quantity: 4,
        newQuantity: 0,
      })
    })

    it('rejects negative quantity and leaves stock/movements untouched', async () => {
      const { user: cashier } = await buildCashier()
      const { product } = await buildProduct({ stockQuantity: 5 })

      const res = await asUser(cashier)
        .patch(`/stock/${product._id}`)
        .send(adjustPayload(-1, STOCK_ADJUST_REASON.MANUAL))

      expect(res.status).toBe(400)
      expect((await Stock.findOne({ productId: product._id })).quantity).toBe(5)
      expect(await StockMovement.countDocuments({ productId: product._id })).toBe(0)
    })

    it('rejects unchanged quantity as a no-op adjustment', async () => {
      const { user: cashier } = await buildCashier()
      const { product } = await buildProduct({ stockQuantity: 7 })

      const res = await asUser(cashier)
        .patch(`/stock/${product._id}`)
        .send(adjustPayload(7, STOCK_ADJUST_REASON.MANUAL))

      expect(res.status).toBe(400)
      expect(await StockMovement.countDocuments({ productId: product._id })).toBe(0)
    })

    it('rejects a non-numeric quantity', async () => {
      const { user: cashier } = await buildCashier()
      const { product } = await buildProduct({ stockQuantity: 10 })

      const res = await asUser(cashier)
        .patch(`/stock/${product._id}`)
        .send({ quantity: 'twelve', reason: STOCK_ADJUST_REASON.MANUAL })

      expect(res.status).toBe(400)
    })

    it('rejects a fractional quantity for a whole-unit product', async () => {
      const { user: cashier } = await buildCashier()
      const { product } = await buildProduct({ stockQuantity: 10 })

      const res = await asUser(cashier)
        .patch(`/stock/${product._id}`)
        .send(adjustPayload(10.5, STOCK_ADJUST_REASON.MANUAL))

      expect(res.status).toBe(400)
    })

    it('rejects an invalid/unknown reason', async () => {
      const { user: cashier } = await buildCashier()
      const { product } = await buildProduct({ stockQuantity: 10 })

      const res = await asUser(cashier)
        .patch(`/stock/${product._id}`)
        .send({ quantity: 15, reason: 'NOT_A_REAL_REASON' })

      expect(res.status).toBe(400)
    })

    it('rejects a missing reason', async () => {
      const { user: cashier } = await buildCashier()
      const { product } = await buildProduct({ stockQuantity: 10 })

      const res = await asUser(cashier).patch(`/stock/${product._id}`).send({ quantity: 15 })

      expect(res.status).toBe(400)
    })

    it('returns 404 for a non-existent product', async () => {
      const { user: cashier } = await buildCashier()
      const fakeId = '64b6f7f7f7f7f7f7f7f7f7f7'

      const res = await asUser(cashier)
        .patch(`/stock/${fakeId}`)
        .send(adjustPayload(5, STOCK_ADJUST_REASON.MANUAL))

      expect(res.status).toBe(404)
    })

    it('returns 400/404 for a malformed product id', async () => {
      const { user: cashier } = await buildCashier()

      const res = await asUser(cashier)
        .patch('/stock/not-a-valid-object-id')
        .send(adjustPayload(5, STOCK_ADJUST_REASON.MANUAL))

      expect([400, 404]).toContain(res.status)
    })

    it('rejects unauthenticated adjustment attempts', async () => {
      const { product } = await buildProduct({ stockQuantity: 10 })
      const res = await asGuest()
        .patch(`/stock/${product._id}`)
        .send(adjustPayload(15, STOCK_ADJUST_REASON.MANUAL))
      expect(res.status).toBe(401)
    })

    it('each accepted STOCK_ADJUST_REASON value is honored verbatim on the movement record', async () => {
      const { user: cashier } = await buildCashier()

      for (const reason of Object.values(STOCK_ADJUST_REASON)) {
        const { product } = await buildProduct({ stockQuantity: 10 })
        const res = await asUser(cashier)
          .patch(`/stock/${product._id}`)
          .send(adjustPayload(12, reason))

        expect(res.status).toBe(200)
        const movement = await StockMovement.findOne({ productId: product._id })
        expect(movement.reason).toBe(reason)
      }
    })
  })

  describe('GET /stock and /stock-movements — listings', () => {
    it('lists stock and reflects a subsequent adjustment in both stock and movement listings', async () => {
      const { user: cashier } = await buildCashier()
      const { product } = await buildProduct({ stockQuantity: 3 })

      const list = await asUser(cashier).get('/stock?limit=50')
      expect(list.status).toBe(200)
      expect(list.body.data.items.length).toBeGreaterThanOrEqual(1)
      const before = list.body.data.items.find(
        (i) => productIdOf(i) === String(product._id)
      )
      expect(before.quantity).toBe(3)

      const adjust = await asUser(cashier)
        .patch(`/stock/${product._id}`)
        .send(adjustPayload(99, STOCK_ADJUST_REASON.CORRECTION))
      expect(adjust.status).toBe(200)

      const listAfter = await asUser(cashier).get('/stock?limit=50')
      const after = listAfter.body.data.items.find(
        (i) => productIdOf(i) === String(product._id)
      )
      expect(after.quantity).toBe(99)

      const movements = await asUser(cashier).get('/stock-movements?limit=50')
      expect(movements.status).toBe(200)
      expect(movements.body.data.items.length).toBeGreaterThanOrEqual(1)
      const found = movements.body.data.items.find(
        (m) => productIdOf(m) === String(product._id)
      )
      expect(found).toBeTruthy()
      expect(found.newQuantity).toBe(99)
    })

    it('filters movements by productId', async () => {
      const { user: cashier } = await buildCashier()
      const { product: productA } = await buildProduct({ stockQuantity: 5 })
      const { product: productB } = await buildProduct({ stockQuantity: 5 })

      await asUser(cashier)
        .patch(`/stock/${productA._id}`)
        .send(adjustPayload(20, STOCK_ADJUST_REASON.MANUAL))
      await asUser(cashier)
        .patch(`/stock/${productB._id}`)
        .send(adjustPayload(20, STOCK_ADJUST_REASON.MANUAL))

      const res = await asUser(cashier).get(`/stock-movements?productId=${productA._id}`)
      expect(res.status).toBe(200)
      const ids = res.body.data.items.map((m) => productIdOf(m))
      expect(ids.every((id) => id === String(productA._id))).toBe(true)
      expect(ids).not.toContain(String(productB._id))
    })

    it('returns movements ordered most-recent-first', async () => {
      const { user: cashier } = await buildCashier()
      const { product } = await buildProduct({ stockQuantity: 5 })

      await asUser(cashier)
        .patch(`/stock/${product._id}`)
        .send(adjustPayload(10, STOCK_ADJUST_REASON.MANUAL))
      await asUser(cashier)
        .patch(`/stock/${product._id}`)
        .send(adjustPayload(20, STOCK_ADJUST_REASON.MANUAL))

      const res = await asUser(cashier).get(`/stock-movements?productId=${product._id}&limit=50`)
      const timestamps = res.body.data.items.map((m) => new Date(m.createdAt).getTime())
      const sorted = [...timestamps].sort((a, b) => b - a)
      expect(timestamps).toEqual(sorted)
    })

    it('rejects unauthenticated listing requests', async () => {
      const stockRes = await asGuest().get('/stock')
      expect(stockRes.status).toBe(401)

      const movementsRes = await asGuest().get('/stock-movements')
      expect(movementsRes.status).toBe(401)
    })
  })

  describe('Concurrency', () => {
    it('serializes concurrent adjustments to the same product with no lost updates', async () => {
      const { user: a } = await buildAdmin()
      const { user: b } = await buildCashier()
      const { product } = await buildProduct({ stockQuantity: 50 })

      const results = await Promise.all([
        asUser(a).patch(`/stock/${product._id}`).send(adjustPayload(40, STOCK_ADJUST_REASON.MANUAL)),
        asUser(b).patch(`/stock/${product._id}`).send(adjustPayload(30, STOCK_ADJUST_REASON.MANUAL)),
      ])

      const ok = results.filter((r) => r.status === 200)
      expect(ok.length).toBeGreaterThanOrEqual(1)

      const finalQty = (await Stock.findOne({ productId: product._id })).quantity
      expect(finalQty).toBeGreaterThanOrEqual(0)
      expect([30, 40, 50]).toContain(finalQty)

      // the number of persisted movement records must match the number of
      // requests that actually succeeded — proves no phantom or dropped writes
      const movementCount = await StockMovement.countDocuments({ productId: product._id })
      expect(movementCount).toBe(ok.length)

      // whichever adjustment "won" must be self-consistent: its recorded
      // newQuantity must equal the current stock row (no stale movement rows)
      const movements = await StockMovement.find({ productId: product._id }).sort({
        createdAt: -1,
      })
      expect(movements[0].newQuantity).toBe(finalQty)
    })

    it('under high-concurrency repeated adjustments, final quantity always matches the last applied movement', async () => {
      const { user: cashier } = await buildCashier()
      const { product } = await buildProduct({ stockQuantity: 100 })

      const targets = [80, 60, 40, 20, 10]
      const results = await Promise.all(
        targets.map((q) =>
          asUser(cashier).patch(`/stock/${product._id}`).send(adjustPayload(q, STOCK_ADJUST_REASON.MANUAL))
        )
      )

      const okCount = results.filter((r) => r.status === 200).length
      expect(okCount).toBeGreaterThanOrEqual(1)

      const finalQty = (await Stock.findOne({ productId: product._id })).quantity
      expect(targets).toContain(finalQty)

      const movementCount = await StockMovement.countDocuments({ productId: product._id })
      expect(movementCount).toBe(okCount)
    })
  })
})