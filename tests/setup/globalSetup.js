import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const URI_FILE = join(__dirname, '.mongo-uri')

let replSet

export default async function globalSetup() {
  mkdirSync(__dirname, { recursive: true })

  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  })

  const uri = replSet.getUri('suits-test')
  writeFileSync(URI_FILE, uri, 'utf8')
  process.env.MONGODB_URI = uri
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-suits-pos'
  process.env.NODE_ENV = 'test'

  return async () => {
    if (replSet) {
      await replSet.stop()
      replSet = null
    }
  }
}
