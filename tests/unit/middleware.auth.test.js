import { describe, it, expect, vi, beforeEach } from 'vitest'
import JWT from 'jsonwebtoken'
import {
  CheckToken,
  CheckAdmin,
  CheckCashierOrAdmin,
} from '../../src/middleware/Admin.middleware.js'
import { ROLES } from '../../src/constants/enums.js'
import { buildAdmin, buildCashier } from '../factories/user.factory.js'

function mockRes() {
  const res = {}
  res.statusCode = 200
  res.body = null
  res.status = (code) => {
    res.statusCode = code
    return res
  }
  res.json = (payload) => {
    res.body = payload
    return res
  }
  return res
}

describe('Middleware unit — CheckToken / CheckAdmin / CheckCashierOrAdmin', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret-suits-pos'
  })

  it('CheckToken rejects missing token', async () => {
    const req = { headers: {} }
    const res = mockRes()
    const next = vi.fn()
    await CheckToken(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(401)
  })

  it('CheckToken attaches user for valid token', async () => {
    const { user } = await buildCashier()
    const token = JWT.sign({ id: user._id }, process.env.JWT_SECRET)
    const req = { headers: { token } }
    const res = mockRes()
    const next = vi.fn()
    await CheckToken(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(String(req.user._id)).toBe(String(user._id))
  })

  it('CheckAdmin blocks cashier', async () => {
    const { user } = await buildCashier()
    const req = { user }
    const res = mockRes()
    const next = vi.fn()
    await CheckAdmin(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(403)
  })

  it('CheckAdmin allows admin', async () => {
    const { user } = await buildAdmin()
    const req = { user }
    const res = mockRes()
    const next = vi.fn()
    await CheckAdmin(req, res, next)
    expect(next).toHaveBeenCalled()
  })

  it('CheckCashierOrAdmin allows both roles', async () => {
    const { user: cashier } = await buildCashier()
    const { user: admin } = await buildAdmin()

    for (const user of [cashier, admin]) {
      const req = { user }
      const res = mockRes()
      const next = vi.fn()
      await CheckCashierOrAdmin(req, res, next)
      expect(next).toHaveBeenCalled()
    }
  })

  it('CheckCashierOrAdmin rejects unknown role object', async () => {
    const req = { user: { role: 'hacker' } }
    const res = mockRes()
    const next = vi.fn()
    await CheckCashierOrAdmin(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(403)
  })
})

describe('Utils — generateInvoiceNumber uniqueness helper', () => {
  it('produces INV-YYYYMMDD-#### pattern', async () => {
    const { generateInvoiceNumber } = await import(
      '../../src/utils/invoiceNumber.js'
    )
    const n = generateInvoiceNumber()
    expect(n).toMatch(/^INV-\d{8}-[A-Z0-9]+$/i)
  })
})
