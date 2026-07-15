import argon2 from 'argon2'
import JWT from 'jsonwebtoken'
import { User } from '../../DB/Users/Users.js'
import { ROLES } from '../../src/constants/enums.js'

let userSeq = 0

const fastHash = (password) =>
  argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 10,
    timeCost: 1,
    parallelism: 1,
  })

export async function buildUser(overrides = {}) {
  userSeq += 1
  const password = overrides.password || 'Cashier@12345'
  const hashed =
    overrides.hashedPassword ||
    (await fastHash(password))

  const doc = await User.create({
    name: overrides.name || `User ${userSeq}`,
    email: overrides.email || `user${userSeq}@suits.com`,
    password: hashed,
    phone: overrides.phone || `0100${String(userSeq).padStart(7, '0')}`,
    role: overrides.role || ROLES.CASHIER,
    isFrozen: overrides.isFrozen ?? false,
  })

  return { user: doc, password }
}

export async function buildAdmin(overrides = {}) {
  return buildUser({
    name: 'Admin Test',
    email: overrides.email || `admin${Date.now()}${userSeq}@suits.com`,
    role: ROLES.ADMIN,
    ...overrides,
  })
}

export async function buildCashier(overrides = {}) {
  return buildUser({
    name: 'Cashier Test',
    email: overrides.email || `cashier${Date.now()}${userSeq}@suits.com`,
    role: ROLES.CASHIER,
    ...overrides,
  })
}

export function signToken(userId, options = {}) {
  const secret = process.env.JWT_SECRET || 'test-jwt-secret-suits-pos'
  return JWT.sign({ id: userId }, secret, options)
}

export function authHeader(token) {
  return { token }
}
