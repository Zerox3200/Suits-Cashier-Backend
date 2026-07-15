import { describe, it, expect } from 'vitest'
import { api, asUser } from '../helpers/http.js'
import {
  buildAdmin,
  buildCashier,
  buildUser,
  signToken,
  authHeader,
} from '../factories/user.factory.js'
import { buildProduct, buildCategory, buildSupplier } from '../factories/catalog.factory.js'
import { ROLES } from '../../src/constants/enums.js'
import { MSG } from '../../src/constants/messages.ar.js'
import { User } from '../../DB/Users/Users.js'

/**
 * Authorization matrix: every sensitive endpoint against Guest / Cashier / Admin / Frozen.
 */
describe('RBAC authorization matrix', () => {
  const cases = [
    {
      name: 'GET /dashboard',
      call: (client) => client.get('/dashboard'),
      guest: 401,
      cashier: 403,
      admin: 200,
      frozen: 403,
    },
    {
      name: 'GET /activity-logs',
      call: (client) => client.get('/activity-logs'),
      guest: 401,
      cashier: 403,
      admin: 200,
      frozen: 403,
    },
    {
      name: 'GET /auth/users',
      call: (client) => client.get('/auth/users'),
      guest: 401,
      cashier: 403,
      admin: 200,
      frozen: 403,
    },
    {
      name: 'PUT /settings',
      call: (client) =>
        client.put('/settings').send({ storeName: 'Test Shop', receiptWidth: '80mm' }),
      guest: 401,
      cashier: 403,
      admin: 200,
      frozen: 403,
    },
    {
      name: 'GET /settings',
      call: (client) => client.get('/settings'),
      guest: 401,
      cashier: 200,
      admin: 200,
      frozen: 403,
    },
    {
      name: 'GET /products',
      call: (client) => client.get('/products'),
      guest: 401,
      cashier: 200,
      admin: 200,
      frozen: 403,
    },
    {
      name: 'GET /stock',
      call: (client) => client.get('/stock'),
      guest: 401,
      cashier: 200,
      admin: 200,
      frozen: 403,
    },
    {
      name: 'GET /stock-movements',
      call: (client) => client.get('/stock-movements'),
      guest: 401,
      cashier: 200,
      admin: 200,
      frozen: 403,
    },
    {
      name: 'GET /invoices',
      call: (client) => client.get('/invoices'),
      guest: 401,
      cashier: 200,
      admin: 200,
      frozen: 403,
    },
    {
      name: 'GET /categories',
      call: (client) => client.get('/categories'),
      guest: 401,
      cashier: 200,
      admin: 200,
      frozen: 403,
    },
    {
      name: 'GET /suppliers',
      call: (client) => client.get('/suppliers'),
      guest: 401,
      cashier: 200,
      admin: 200,
      frozen: 403,
    },
    // --- Write operations, previously untested by the matrix ---
    // Assumption: these routes/payload shapes mirror the read equivalents above;
    // confirm exact field names against your actual category/supplier controllers.
    {
      name: 'POST /categories',
      call: (client) => client.post('/categories').send({ name: 'RBAC Test Category' }),
      guest: 401,
      cashier: 403,
      admin: 201,
      frozen: 403,
    },
    {
      name: 'POST /suppliers',
      call: (client) => client.post('/suppliers').send({ name: 'RBAC Test Supplier' }),
      guest: 401,
      cashier: 403,
      admin: 201,
      frozen: 403,
    },
    {
      name: 'POST /stock-movements',
      call: (client) =>
        client.post('/stock-movements').send({ type: 'ADJUSTMENT', quantity: 1 }),
      guest: 401,
      // Assumption: cashiers can record stock movements (e.g. sales) but not
      // arbitrary adjustments — flag/remove if your real rule differs.
      cashier: 400,
      admin: 400,
      frozen: 403,
    },
    {
      name: 'POST /invoices',
      call: (client) => client.post('/invoices').send({ items: [] }),
      guest: 401,
      cashier: 400,
      admin: 400,
      frozen: 403,
    },
  ]

  for (const c of cases) {
    describe(c.name, () => {
      it(`guest → ${c.guest}`, async () => {
        const res = await c.call(api())
        expect(res.status).toBe(c.guest)
      })

      it(`cashier → ${c.cashier}`, async () => {
        const { user } = await buildCashier()
        const res = await c.call(asUser(user))
        expect(res.status).toBe(c.cashier)
      })

      it(`admin → ${c.admin}`, async () => {
        const { user } = await buildAdmin()
        const res = await c.call(asUser(user))
        expect(res.status).toBe(c.admin)
      })

      it(`frozen user → ${c.frozen}`, async () => {
        const { user } = await buildCashier({ isFrozen: true })
        const res = await c.call(asUser(user))
        expect(res.status).toBe(c.frozen)
      })
    })
  }

  // The original suite only ever froze a cashier. A frozen admin must be
  // blocked identically — role alone shouldn't override the freeze check.
  it('blocks a frozen admin the same as a frozen cashier', async () => {
    const { user: frozenAdmin } = await buildAdmin({ isFrozen: true })
    const res = await asUser(frozenAdmin).get('/dashboard')
    expect(res.status).toBe(403)
  })

  it('blocks product deactivate for cashier', async () => {
    const { user: admin } = await buildAdmin()
    const { user: cashier } = await buildCashier()
    const { product } = await buildProduct({ createdBy: admin._id })
    const res = await asUser(cashier).patch(`/products/${product._id}/deactivate`)
    expect(res.status).toBe(403)
    expect(res.body.message).toBe(MSG.ONLY_ADMIN)
  })

  it('blocks category delete for cashier', async () => {
    const { user: admin } = await buildAdmin()
    const { user: cashier } = await buildCashier()
    const category = await buildCategory({ createdBy: admin._id })
    const res = await asUser(cashier).delete(`/categories/${category._id}`)
    expect(res.status).toBe(403)
  })

  it('allows category delete for admin', async () => {
    const { user: admin } = await buildAdmin()
    const category = await buildCategory({ createdBy: admin._id })
    const res = await asUser(admin).delete(`/categories/${category._id}`)
    expect(res.status).toBe(200)
  })

  it('blocks supplier delete for cashier', async () => {
    const { user: admin } = await buildAdmin()
    const { user: cashier } = await buildCashier()
    const supplier = await buildSupplier({ createdBy: admin._id })
    const res = await asUser(cashier).delete(`/suppliers/${supplier._id}`)
    expect(res.status).toBe(403)
  })

  it('allows supplier delete for admin', async () => {
    const { user: admin } = await buildAdmin()
    const supplier = await buildSupplier({ createdBy: admin._id })
    const res = await asUser(admin).delete(`/suppliers/${supplier._id}`)
    expect(res.status).toBe(200)
  })

  describe('token edge cases', () => {
    it('rejects invalid token on privileged route', async () => {
      const res = await api()
        .get('/dashboard')
        .set(authHeader('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.sig'))
      expect(res.status).toBeGreaterThanOrEqual(400)
    })

    it('rejects privilege escalation via role claim in JWT (role not in token)', async () => {
      const { user } = await buildCashier()
      // Token only carries id — forging role claim must not elevate
      const forged = signToken(user._id)
      const decoded = JSON.parse(
        Buffer.from(forged.split('.')[1], 'base64url').toString()
      )
      expect(decoded.role).toBeUndefined()
      const res = await api().get('/dashboard').set(authHeader(forged))
      expect(res.status).toBe(403)
    })

    it('rejects a token with a tampered payload', async () => {
      const { user } = await buildCashier()
      const token = signToken(user._id)
      const [header, payload, signature] = token.split('.')
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString())
      const tamperedPayload = Buffer.from(
        JSON.stringify({ ...decoded, role: 'ADMIN' })
      ).toString('base64url')
      const tamperedToken = `${header}.${tamperedPayload}.${signature}`

      const res = await api().get('/dashboard').set(authHeader(tamperedToken))
      // Signature no longer matches → reject as unauthorized (not RBAC 403).
      expect(res.status).toBe(401)
    })

    it('rejects an expired token', async () => {
      const { user } = await buildCashier()
      // Assumption: signToken accepts an options object with expiresIn — adjust
      // to your actual signing helper's signature if different.
      const expired = signToken(user._id, { expiresIn: '-1s' })
      const res = await api().get('/settings').set(authHeader(expired))
      expect(res.status).toBe(401)
    })

    it('rejects a token whose user no longer exists', async () => {
      const { user } = await buildCashier()
      const token = signToken(user._id)
      await User.findByIdAndDelete(user._id)

      const res = await api().get('/settings').set(authHeader(token))
      expect(res.status).toBe(401)
    })

    it('rejects an Authorization header missing the Bearer scheme', async () => {
      const { user } = await buildCashier()
      const token = signToken(user._id)

      const res = await api().get('/settings').set('Authorization', token)
      expect(res.status).toBe(401)
    })

    it('rejects an empty Authorization header', async () => {
      const res = await api().get('/settings').set('Authorization', '')
      expect(res.status).toBe(401)
    })
  })

  // Sweeps every role defined in the app's enum against an admin-only route,
  // so a newly-added role can't silently slip through without matrix coverage.
  it('blocks every non-admin role from an admin-only route', async () => {
    const nonAdminRoles = Object.values(ROLES).filter((r) => r !== ROLES.ADMIN)
    expect(nonAdminRoles.length).toBeGreaterThan(0)

    for (const role of nonAdminRoles) {
      const { user } = await buildUser({ role })
      const res = await asUser(user).get('/dashboard')
      expect(res.status, `expected role "${role}" to be blocked from /dashboard`).toBe(403)
    }
  })
})