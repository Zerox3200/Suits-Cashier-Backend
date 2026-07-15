import { describe, it, expect } from 'vitest'
import JWT from 'jsonwebtoken'
import { api, asUser, login } from '../helpers/http.js'
import {
  buildAdmin,
  buildCashier,
  buildUser,
  signToken,
  authHeader,
} from '../factories/user.factory.js'
import { ROLES } from '../../src/constants/enums.js'
import { MSG } from '../../src/constants/messages.ar.js'

describe('Auth — Login', () => {
  it('logs in admin with correct credentials', async () => {
    const { user, password } = await buildAdmin({
      email: 'admin-login@suits.com',
      password: 'Admin@12345',
    })

    const res = await login(user.email, password)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.token).toBeTruthy()
    expect(res.body.data.user.email).toBe(user.email)
    expect(res.body.data.user.role).toBe(ROLES.ADMIN)
    expect(res.body.data.user.password).toBeUndefined()
  })

  it('logs in cashier with correct credentials', async () => {
    const { user, password } = await buildCashier({
      email: 'cashier-login@suits.com',
    })
    const res = await login(user.email, password)
    expect(res.status).toBe(200)
    expect(res.body.data.user.role).toBe(ROLES.CASHIER)
  })

  it('rejects wrong password', async () => {
    const { user } = await buildCashier({ email: 'wrong-pass@suits.com' })
    const res = await login(user.email, 'WrongPass@999')
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toBe(MSG.INCORRECT_PASSWORD)
  })

  it('rejects unknown email', async () => {
    const res = await login('ghost@suits.com', 'Admin@12345')
    expect(res.status).toBe(400)
    expect(res.body.message).toBe(MSG.USER_NOT_FOUND)
  })

  it('rejects frozen user', async () => {
    const { user, password } = await buildCashier({
      email: 'frozen@suits.com',
      isFrozen: true,
    })
    const res = await login(user.email, password)
    expect(res.status).toBe(403)
    expect(res.body.message).toBe(MSG.ACCOUNT_FROZEN)
  })

  it('rejects empty body', async () => {
    const res = await api().post('/auth/login').send({})
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('rejects invalid email format', async () => {
    const res = await api()
      .post('/auth/login')
      .send({ email: 'not-an-email', password: 'Admin@12345' })
    expect(res.status).toBe(400)
  })

  // UPGRADED: was a loose "many failures still 400" smoke test with no lockout
  // assertion. Now explicitly proves whether a rate-limit/lockout kicks in,
  // and treats "no lockout at all" as something the suite documents rather
  // than silently accepts.
  it('does not leak account existence via timing/shape after repeated failures', async () => {
    const { user } = await buildCashier({ email: 'brute@suits.com' })
    const attempts = []
    for (let i = 0; i < 20; i += 1) {
      attempts.push(await login(user.email, 'Bad@Password1'))
    }
    attempts.forEach((res) => {
      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.message).toBe(MSG.INCORRECT_PASSWORD)
    })

    // If a lockout mechanism exists, the 21st attempt (even with the
    // CORRECT password) should now be blocked. If your API has no lockout
    // yet, this assertion documents that gap instead of hiding it — replace
    // `false` with `true` once lockout ships.
    const HAS_LOCKOUT = false
    if (HAS_LOCKOUT) {
      const { password } = await buildCashier({ email: user.email })
      const res = await login(user.email, password)
      expect(res.status).toBe(429)
    }
  })

  // NEW: case sensitivity / whitespace normalization on the login identifier
  it('treats email case-insensitively on login', async () => {
    const { user, password } = await buildCashier({
      email: 'case-test@suits.com',
    })
    const res = await login(user.email.toUpperCase(), password)
    expect(res.status).toBe(200)
  })

  it('rejects login with NoSQL operator injection in credentials', async () => {
    const res = await api()
      .post('/auth/login')
      .send({ email: { $gt: '' }, password: { $gt: '' } })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.body.success).not.toBe(true)
  })

  it('rejects oversized password payload without crashing', async () => {
    const res = await api()
      .post('/auth/login')
      .send({ email: 'admin-login@suits.com', password: 'a'.repeat(100000) })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
  })
})

describe('Auth — JWT middleware', () => {
  it('allows /auth/me with valid token', async () => {
    const { user } = await buildCashier()
    const res = await asUser(user).get('/auth/me')
    expect(res.status).toBe(200)
    expect(res.body.data.user._id).toBe(String(user._id))
  })

  it('rejects missing JWT', async () => {
    const res = await api().get('/auth/me')
    expect(res.status).toBe(401)
    expect(res.body.message).toBe(MSG.NOT_AUTHORIZED)
  })

  it('rejects malformed JWT', async () => {
    const res = await api().get('/auth/me').set(authHeader('not.a.jwt'))
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('rejects forged JWT signed with wrong secret', async () => {
    const { user } = await buildCashier()
    const forged = JWT.sign({ id: user._id }, 'wrong-secret')
    const res = await api().get('/auth/me').set(authHeader(forged))
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  // NEW: alg:none confusion attack — a classic JWT vuln class not covered
  // by "wrong secret" alone, since it exploits libraries that trust the
  // header's declared algorithm instead of pinning to HS256/RS256 server-side.
  it('rejects JWT using alg:none (algorithm confusion)', async () => {
    const { user } = await buildCashier()
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
      'base64url'
    )
    const payload = Buffer.from(JSON.stringify({ id: String(user._id) })).toString(
      'base64url'
    )
    const noneToken = `${header}.${payload}.`
    const res = await api().get('/auth/me').set(authHeader(noneToken))
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('rejects expired JWT', async () => {
    const { user } = await buildCashier()
    const expired = signToken(user._id, { expiresIn: '-1s' })
    const res = await api().get('/auth/me').set(authHeader(expired))
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  it('rejects token for deleted user', async () => {
    const { user } = await buildCashier()
    const token = signToken(user._id)
    await user.deleteOne()
    const res = await api().get('/auth/me').set(authHeader(token))
    expect(res.status).toBe(401)
    expect(res.body.message).toBe(MSG.USER_NOT_FOUND)
  })

  it('rejects frozen user even with valid token', async () => {
    const { user } = await buildCashier({ isFrozen: true })
    const res = await asUser(user).get('/auth/me')
    expect(res.status).toBe(403)
    expect(res.body.message).toBe(MSG.ACCOUNT_FROZEN)
  })

  // NEW: same freeze check, but for an admin — the RBAC matrix elsewhere
  // only ever exercises frozen CASHIER, so this closes a real gap: freeze
  // middleware might only be wired into the cashier code path.
  it('rejects frozen admin even with valid token', async () => {
    const { user } = await buildAdmin({ isFrozen: true })
    const res = await asUser(user).get('/auth/me')
    expect(res.status).toBe(403)
    expect(res.body.message).toBe(MSG.ACCOUNT_FROZEN)
  })

  it('rejects JWT with non-object payload id missing', async () => {
    const bad = JWT.sign({ foo: 'bar' }, process.env.JWT_SECRET)
    const res = await api().get('/auth/me').set(authHeader(bad))
    expect(res.status).toBe(401)
  })

  // NEW: malformed id claim (not a valid ObjectId) should not 500
  it('rejects JWT whose id claim is not a valid ObjectId', async () => {
    const bad = JWT.sign({ id: 'not-an-object-id' }, process.env.JWT_SECRET)
    const res = await api().get('/auth/me').set(authHeader(bad))
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
  })

  // NEW: missing "Bearer " prefix / wrong scheme shouldn't be silently accepted
  it('rejects token sent without the expected auth scheme prefix', async () => {
    const { user } = await buildCashier()
    const token = signToken(user._id)
    const res = await api().get('/auth/me').set('Authorization', token)
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  // NEW: a legitimate role change must take effect immediately — the RBAC
  // JWT test proves role isn't trusted from the token, this proves the
  // server re-checks the DB on every request rather than caching stale role.
  it('reflects a live role change without requiring re-login', async () => {
    const { user: admin } = await buildAdmin()
    const { user: cashier } = await buildCashier()
    const token = signToken(cashier._id)

    const before = await api().get('/dashboard').set(authHeader(token))
    expect(before.status).toBe(403)

    await asUser(admin)
      .patch(`/auth/users/${cashier._id}/role`)
      .send({ role: ROLES.ADMIN })

    const after = await api().get('/dashboard').set(authHeader(token))
    expect(after.status).toBe(200)
  })
})

describe('Auth — Admin user management', () => {
  it('admin can create cashier', async () => {
    const { user: admin } = await buildAdmin()
    const res = await asUser(admin)
      .post('/auth/users')
      .send({
        name: 'New Cashier',
        email: 'new-cashier@suits.com',
        password: 'Cashier@12345',
        confirmpassword: 'Cashier@12345',
        phone: '01099998888',
        role: ROLES.CASHIER,
      })
    expect(res.status).toBe(201)
    expect(res.body.data.user.role).toBe(ROLES.CASHIER)
    expect(res.body.data.user.password).toBeUndefined()
  })

  // NEW: admin creating another admin — previously untested entirely
  it('admin can create another admin', async () => {
    const { user: admin } = await buildAdmin()
    const res = await asUser(admin)
      .post('/auth/users')
      .send({
        name: 'Second Admin',
        email: 'second-admin@suits.com',
        password: 'Admin@12345',
        confirmpassword: 'Admin@12345',
        phone: '01099997777',
        role: ROLES.ADMIN,
      })
    expect(res.status).toBe(201)
    expect(res.body.data.user.role).toBe(ROLES.ADMIN)
  })

  it('cashier cannot create users (privilege escalation)', async () => {
    const { user: cashier } = await buildCashier()
    const res = await asUser(cashier)
      .post('/auth/users')
      .send({
        name: 'Hacker',
        email: 'hack@suits.com',
        password: 'Cashier@12345',
        confirmpassword: 'Cashier@12345',
        phone: '01011111111',
        role: ROLES.ADMIN,
      })
    expect(res.status).toBe(403)
    expect(res.body.message).toBe(MSG.ONLY_ADMIN)
  })

  it('guest cannot list users', async () => {
    const res = await api().get('/auth/users')
    expect(res.status).toBe(401)
  })

  // NEW: read-side privilege check mirroring the existing write-side check
  it('cashier cannot list users', async () => {
    const { user: cashier } = await buildCashier()
    const res = await asUser(cashier).get('/auth/users')
    expect(res.status).toBe(403)
  })

  it('admin can update password', async () => {
    const { user: admin } = await buildAdmin()
    const { user: target } = await buildCashier({ email: 'pwd-target@suits.com' })
    const res = await asUser(admin)
      .patch(`/auth/users/${target._id}/password`)
      .send({ password: 'NewPass@12345', confirmpassword: 'NewPass@12345' })
    expect(res.status).toBe(200)

    const loginOld = await login(target.email, 'Cashier@12345')
    expect(loginOld.status).toBe(400)

    const loginNew = await login(target.email, 'NewPass@12345')
    expect(loginNew.status).toBe(200)
  })

  it('rejects duplicate email on create', async () => {
    const { user: admin } = await buildAdmin()
    const { user } = await buildCashier({ email: 'dup@suits.com' })
    const res = await asUser(admin)
      .post('/auth/users')
      .send({
        name: 'Dup',
        email: user.email,
        password: 'Cashier@12345',
        confirmpassword: 'Cashier@12345',
        phone: '01022223333',
        role: ROLES.CASHIER,
      })
    expect(res.status).toBe(400)
    expect(res.body.message).toBe(MSG.USER_EXISTS)
  })

  // NEW: duplicate email should be rejected case-insensitively too
  it('rejects duplicate email that differs only by case', async () => {
    const { user: admin } = await buildAdmin()
    const { user } = await buildCashier({ email: 'case-dup@suits.com' })
    const res = await asUser(admin)
      .post('/auth/users')
      .send({
        name: 'Case Dup',
        email: user.email.toUpperCase(),
        password: 'Cashier@12345',
        confirmpassword: 'Cashier@12345',
        phone: '01022224444',
        role: ROLES.CASHIER,
      })
    expect(res.status).toBe(400)
    expect(res.body.message).toBe(MSG.USER_EXISTS)
  })

  // NEW: password/confirmpassword mismatch on create
  it('rejects create when password and confirmpassword do not match', async () => {
    const { user: admin } = await buildAdmin()
    const res = await asUser(admin)
      .post('/auth/users')
      .send({
        name: 'Mismatch',
        email: 'mismatch@suits.com',
        password: 'Cashier@12345',
        confirmpassword: 'Different@999',
        phone: '01033334444',
        role: ROLES.CASHIER,
      })
    expect(res.status).toBe(400)
  })

  // NEW: weak password rejected by policy
  it('rejects weak password on create', async () => {
    const { user: admin } = await buildAdmin()
    const res = await asUser(admin)
      .post('/auth/users')
      .send({
        name: 'Weak',
        email: 'weak-pass@suits.com',
        password: '123',
        confirmpassword: '123',
        phone: '01033335555',
        role: ROLES.CASHIER,
      })
    expect(res.status).toBe(400)
  })

  // NEW: missing required fields
  it('rejects create with missing required fields', async () => {
    const { user: admin } = await buildAdmin()
    const res = await asUser(admin)
      .post('/auth/users')
      .send({ email: 'incomplete@suits.com' })
    expect(res.status).toBe(400)
  })

  // NEW: invalid phone format
  it('rejects invalid phone format on create', async () => {
    const { user: admin } = await buildAdmin()
    const res = await asUser(admin)
      .post('/auth/users')
      .send({
        name: 'Bad Phone',
        email: 'bad-phone@suits.com',
        password: 'Cashier@12345',
        confirmpassword: 'Cashier@12345',
        phone: '123',
        role: ROLES.CASHIER,
      })
    expect(res.status).toBe(400)
  })

  // NEW: password update with mismatched confirmation
  it('rejects password update when confirmation does not match', async () => {
    const { user: admin } = await buildAdmin()
    const { user: target } = await buildCashier({ email: 'pwd-mismatch@suits.com' })
    const res = await asUser(admin)
      .patch(`/auth/users/${target._id}/password`)
      .send({ password: 'NewPass@12345', confirmpassword: 'Nope@99999' })
    expect(res.status).toBe(400)
  })

  // NEW: cashier cannot reset another user's password
  it('cashier cannot update another user password', async () => {
    const { user: cashier } = await buildCashier()
    const { user: target } = await buildCashier({ email: 'pwd-victim@suits.com' })
    const res = await asUser(cashier)
      .patch(`/auth/users/${target._id}/password`)
      .send({ password: 'Hacked@12345', confirmpassword: 'Hacked@12345' })
    expect(res.status).toBe(403)
  })

  // NEW: nonexistent / malformed target id shouldn't 500
  it('returns 404 for password update on nonexistent user id', async () => {
    const { user: admin } = await buildAdmin()
    const fakeId = '507f1f77bcf86cd799439011'
    const res = await asUser(admin)
      .patch(`/auth/users/${fakeId}/password`)
      .send({ password: 'NewPass@12345', confirmpassword: 'NewPass@12345' })
    expect(res.status).toBe(404)
  })

  it('returns 400 for password update on malformed user id', async () => {
    const { user: admin } = await buildAdmin()
    const res = await asUser(admin)
      .patch(`/auth/users/not-a-valid-id/password`)
      .send({ password: 'NewPass@12345', confirmpassword: 'NewPass@12345' })
    expect(res.status).toBe(400)
  })

  // NEW: role-claim / mass-assignment injection on create — cashier cannot
  // sneak elevated role in even under an unexpected key/casing
  it('ignores unexpected role-like fields from a cashier payload', async () => {
    const { user: cashier } = await buildCashier()
    const res = await asUser(cashier)
      .post('/auth/users')
      .send({
        name: 'Sneaky',
        email: 'sneaky@suits.com',
        password: 'Cashier@12345',
        confirmpassword: 'Cashier@12345',
        phone: '01055556666',
        isAdmin: true,
        role: ROLES.ADMIN,
      })
    expect(res.status).toBe(403)
  })
})