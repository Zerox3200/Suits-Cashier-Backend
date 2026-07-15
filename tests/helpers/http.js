import request from 'supertest'
import { createApp } from '../../src/createApp.js'
import { authHeader, signToken } from '../factories/user.factory.js'

let app

export function getApp() {
  if (!app) app = createApp()
  return app
}

export function api() {
  return request(getApp())
}

export function asUser(user) {
  const token = signToken(user._id)
  return {
    token,
    get: (url) => api().get(url).set(authHeader(token)),
    post: (url) => api().post(url).set(authHeader(token)),
    put: (url) => api().put(url).set(authHeader(token)),
    patch: (url) => api().patch(url).set(authHeader(token)),
    delete: (url) => api().delete(url).set(authHeader(token)),
  }
}

/** Unauthenticated client (no token header). */
export function asGuest() {
  return {
    get: (url) => api().get(url),
    post: (url) => api().post(url),
    put: (url) => api().put(url),
    patch: (url) => api().patch(url),
    delete: (url) => api().delete(url),
  }
}

export async function login(email, password) {
  return api().post('/auth/login').send({ email, password })
}
