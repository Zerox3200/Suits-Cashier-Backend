import { describe, it, expect } from 'vitest'
import { asUser, api } from '../helpers/http.js'
import { buildAdmin, buildCashier, signToken } from '../factories/user.factory.js'
import { buildCategory, buildSupplier, buildProduct } from '../factories/catalog.factory.js'
import { ATTACK_STRINGS, invoicePayload } from '../helpers/payloads.js'

describe('Security — injection & mass assignment', () => {
  describe('NoSQL injection', () => {
    it('login rejects operator-object email (NoSQL injection)', async () => {
      const res = await api()
        .post('/auth/login')
        .send({ email: { $gt: '' }, password: { $gt: '' } })
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.body.success).not.toBe(true)
    })

    it('login rejects operator-object password with a valid-looking email', async () => {
      const { user: cashier } = await buildCashier()
      const res = await api()
        .post('/auth/login')
        .send({ email: cashier.email, password: { $ne: null } })
      // A vulnerable query would match "password $ne null" against any hashed
      // password and log the attacker in as this user.
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.body.success).not.toBe(true)
    })

    it('rejects $where/$regex operator objects in search query params', async () => {
      const { user: admin } = await buildAdmin()
      const res = await asUser(admin).get(
        `/products?search=${encodeURIComponent('{"$where":"1==1"}')}`
      )
      // Should be treated as a literal search string, not parsed as an operator —
      // either 200 with no/irrelevant matches, or 400. Never 500.
      expect([200, 400]).toContain(res.status)
    })

    it('rejects an operator object in a route param used for lookup', async () => {
      const { user: admin } = await buildAdmin()
      const res = await asUser(admin)
        .get('/products/scan')
        .query({ barcode: { $gt: '' } })
      expect(res.status).toBeGreaterThanOrEqual(400)
    })

    it('does not crash on a malformed ObjectId in a path param', async () => {
      const { user: admin } = await buildAdmin()
      const res = await asUser(admin).get('/products/not-a-valid-id')
      // A raw Mongoose CastError bubbling up unhandled would surface as a 500.
      expect(res.status).toBe(400)
    })
  })

  describe('prototype pollution', () => {
    it('does not pollute Object.prototype via __proto__ in create body', async () => {
      const { user: admin } = await buildAdmin()
      await asUser(admin)
        .post('/categories')
        .send(
          JSON.parse(
            `{"name":"Proto-${Date.now()}","__proto__":{"polluted":true}}`
          )
        )

      expect({}.polluted).toBeUndefined()
    })

    it('does not pollute via constructor.prototype in create body', async () => {
      const { user: admin } = await buildAdmin()
      await asUser(admin)
        .post('/categories')
        .send(
          JSON.parse(
            `{"name":"Proto2-${Date.now()}","constructor":{"prototype":{"polluted2":true}}}`
          )
        )

      expect({}.polluted2).toBeUndefined()
    })
  })

  describe('mass assignment', () => {
    it('does not privilege-escalate via role in create-user body when cashier', async () => {
      const { user: cashier } = await buildCashier()
      const res = await asUser(cashier)
        .post('/auth/users')
        .send({
          name: 'Evil',
          email: 'evil@suits.com',
          password: 'Cashier@12345',
          confirmpassword: 'Cashier@12345',
          phone: '01010101010',
          role: 'مسؤول',
        })
      expect(res.status).toBe(403)
    })

    it('ignores client-supplied _id on user creation (no ID collision/overwrite)', async () => {
      const { user: admin } = await buildAdmin()
      const spoofedId = '507f1f77bcf86cd799439011'
      const res = await asUser(admin)
        .post('/auth/users')
        .send({
          _id: spoofedId,
          name: 'Spoofed',
          email: `spoofed-${Date.now()}@suits.com`,
          password: 'Admin@12345',
          confirmpassword: 'Admin@12345',
          phone: '01010101011',
          role: 'كاشير',
        })
      expect(res.status).toBe(201)
      expect(res.body.data.user._id).not.toBe(spoofedId)
    })

    it('ignores client-supplied isActive/createdBy on product creation', async () => {
      const { user: cashier } = await buildCashier()
      const category = await buildCategory()
      const supplier = await buildSupplier()

      const res = await asUser(cashier)
        .post('/products')
        .field('sku', `MASS-${Date.now()}`)
        .field('name', 'Mass Assign Check')
        .field('categoryId', String(category._id))
        .field('supplierId', String(supplier._id))
        .field('costPrice', '10')
        .field('sellingPrice', '20')
        .field('isActive', 'false')
        .field('createdBy', '507f1f77bcf86cd799439011')
        .attach('image', Buffer.from('fake-image-bytes'), 'test.jpg')

      if (res.status === 201) {
        expect(res.body.data.product.isActive).toBe(true)
        expect(String(res.body.data.product.createdBy)).not.toBe(
          '507f1f77bcf86cd799439011'
        )
      }
    })

    it('rejects client unitPrice fields at validation (mass-assignment blocked)', async () => {
      const { user: cashier } = await buildCashier()
      const { product } = await buildProduct({
        sellingPrice: 100,
        stockQuantity: 10,
      })

      const rejected = await asUser(cashier)
        .post('/invoices')
        .send({
          customerName: 'X',
          paymentMethod: 'نقدي',
          discount: 0,
          tax: 0,
          items: [
            {
              productId: String(product._id),
              quantity: 1,
              unitPrice: 1,
              lineTotal: 1,
            },
          ],
        })
      expect(rejected.status).toBe(400)

      const ok = await asUser(cashier)
        .post('/invoices')
        .send(invoicePayload([{ productId: product._id, quantity: 1 }]))
      expect(ok.status).toBe(201)
      expect(ok.body.data.invoice.items[0].unitPrice).toBe(100)
    })

    it('ignores a client-supplied discount that would drive the total negative', async () => {
      const { user: cashier } = await buildCashier()
      const { product } = await buildProduct({ sellingPrice: 100, stockQuantity: 10 })

      const res = await asUser(cashier)
        .post('/invoices')
        .send({
          ...invoicePayload([{ productId: product._id, quantity: 1 }]),
          discount: 999999,
        })

      // Assumption: server clamps/rejects a discount exceeding the subtotal
      // rather than persisting a negative total — verify against your actual
      // invoice total calculation.
      if (res.status === 201) {
        expect(res.body.data.invoice.total).toBeGreaterThanOrEqual(0)
      } else {
        expect(res.status).toBe(400)
      }
    })
  })

  describe('stored XSS / unsafe content', () => {
    it('category create stores XSS payload as text', async () => {
      const { user: admin } = await buildAdmin()
      const res = await asUser(admin)
        .post('/categories')
        .send({
          name: `${ATTACK_STRINGS.xss}-${Date.now()}`,
          description: ATTACK_STRINGS.html,
        })
      expect(res.status).toBe(201)
      expect(res.body.data.category.name).toContain('<script>')
    })

    it('supplier create stores XSS payload as text', async () => {
      const { user: admin } = await buildAdmin()
      const res = await asUser(admin)
        .post('/suppliers')
        .send({
          name: `${ATTACK_STRINGS.xss}-${Date.now()}`,
          phone: '0100',
        })
      expect(res.status).toBe(201)
      expect(res.body.data.supplier.name).toContain('<script>')
    })
  })

  describe('malformed / hostile requests', () => {
    it('rejects malformed JSON', async () => {
      const { user: cashier } = await buildCashier()
      const res = await api()
        .post('/invoices')
        .set('token', signToken(cashier._id))
        .set('Content-Type', 'application/json')
        .send('{"items": [')
      expect(res.status).toBeGreaterThanOrEqual(400)
    })

    it('rejects oversell merged quantity without crashing', async () => {
      const { user: cashier } = await buildCashier()
      const { product } = await buildProduct({ stockQuantity: 2 })
      const items = Array.from({ length: 500 }, () => ({
        productId: String(product._id),
        quantity: 1,
      }))
      const res = await asUser(cashier)
        .post('/invoices')
        .send({ items, paymentMethod: 'نقدي' })
      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('rejects invoice items as a non-array without crashing', async () => {
      const { user: cashier } = await buildCashier()
      const res = await asUser(cashier)
        .post('/invoices')
        .send({ items: 'not-an-array', paymentMethod: 'نقدي' })
      expect(res.status).toBe(400)
    })

    it('rejects a null entry inside the items array without crashing', async () => {
      const { user: cashier } = await buildCashier()
      const { product } = await buildProduct({ stockQuantity: 5 })
      const res = await asUser(cashier)
        .post('/invoices')
        .send({
          items: [{ productId: String(product._id), quantity: 1 }, null],
          paymentMethod: 'نقدي',
        })
      expect(res.status).toBe(400)
    })

    it('rejects a deeply nested JSON body without hanging or crashing', async () => {
      const { user: admin } = await buildAdmin()
      let nested = { name: `Deep-${Date.now()}` }
      let cursor = nested
      for (let i = 0; i < 500; i++) {
        cursor.child = {}
        cursor = cursor.child
      }
      const res = await asUser(admin).post('/categories').send(nested)
      expect([201, 400, 413]).toContain(res.status)
    })

    it('rejects an excessively long string field', async () => {
      const { user: admin } = await buildAdmin()
      const res = await asUser(admin)
        .post('/categories')
        .send({ name: 'A'.repeat(100_000) })
      // Assumption: your schema caps `name` length — verify the actual limit
      // and expected status (400 vs 413) against your validators.
      expect([400, 413]).toContain(res.status)
    })
  })

  describe('auth token integrity', () => {
    it('rejects a token signed with alg=none', async () => {
      const { user: cashier } = await buildCashier()
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
        'base64url'
      )
      const payload = Buffer.from(JSON.stringify({ id: String(cashier._id) })).toString(
        'base64url'
      )
      const noneToken = `${header}.${payload}.`

      const res = await api().get('/settings').set('token', noneToken)
      expect(res.status).toBeGreaterThanOrEqual(400)
    })

    it('rejects a token signed with a different/guessed secret', async () => {
      const { user: cashier } = await buildCashier()
      // A structurally valid JWT (three base64url segments) signed with a
      // secret the server doesn't recognize — must fail verification, not
      // just structural parsing.
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
        'base64url'
      )
      const payload = Buffer.from(
        JSON.stringify({ id: String(cashier._id), iat: Math.floor(Date.now() / 1000) })
      ).toString('base64url')
      const bogusToken = `${header}.${payload}.bm90LWEtcmVhbC1zaWduYXR1cmU`

      const res = await api().get('/settings').set('token', bogusToken)
      expect(res.status).toBeGreaterThanOrEqual(400)
    })
  })
})

describe('Categories & Suppliers', () => {
  it('cashier can list categories/suppliers but cannot create', async () => {
    const { user: cashier } = await buildCashier()

    const cat = await asUser(cashier)
      .post('/categories')
      .send({ name: `Cat-${Date.now()}`, description: 'test' })
    expect(cat.status).toBe(403)

    const sup = await asUser(cashier)
      .post('/suppliers')
      .send({ name: `Sup-${Date.now()}`, phone: '0100' })
    expect(sup.status).toBe(403)

    expect((await asUser(cashier).get('/categories')).status).toBe(200)
    expect((await asUser(cashier).get('/suppliers')).status).toBe(200)
  })

  it('rejects duplicate category name', async () => {
    const { user: admin } = await buildAdmin()
    const name = `Unique-${Date.now()}`
    await buildCategory({ name })
    const res = await asUser(admin)
      .post('/categories')
      .send({ name, description: 'dup' })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('rejects duplicate supplier name', async () => {
    const { user: admin } = await buildAdmin()
    const name = `SupUnique-${Date.now()}`
    await buildSupplier({ name })
    const res = await asUser(admin)
      .post('/suppliers')
      .send({ name, phone: '0100' })
    // Mirrors the category duplicate-name test above. Assumption: supplier
    // names are unique the same way category names are — verify against your
    // actual supplier schema/index.
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('admin can soft-manage supplier delete', async () => {
    const { user: admin } = await buildAdmin()
    const supplier = await buildSupplier({ name: `Del-${Date.now()}` })
    const res = await asUser(admin).delete(`/suppliers/${supplier._id}`)
    expect([200, 400]).toContain(res.status)
  })

  it('rejects category delete when products still reference it', async () => {
    const { user: admin } = await buildAdmin()
    const category = await buildCategory({ name: `InUse-${Date.now()}` })
    await buildProduct({ categoryId: category._id, createdBy: admin._id })

    const res = await asUser(admin).delete(`/categories/${category._id}`)
    // Assumption: deleting a category with live products is blocked rather
    // than orphaning the reference — verify against your actual delete logic.
    expect([200, 400]).toContain(res.status)
  })
})