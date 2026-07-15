import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { beforeAll, afterAll, beforeEach } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const URI_FILE = join(__dirname, '.mongo-uri')

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-suits-pos'
process.env.NODE_ENV = 'test'

beforeAll(async () => {
  const uri = readFileSync(URI_FILE, 'utf8').trim()
  process.env.MONGODB_URI = uri
  mongoose.set('bufferCommands', false)
  await mongoose.connect(uri)
})

beforeEach(async () => {
  const collections = mongoose.connection.collections
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({})
  }
})

afterAll(async () => {
  await mongoose.disconnect()
})
