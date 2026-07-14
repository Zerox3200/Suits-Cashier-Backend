import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import { appRouter } from './src/app.router.js'
import { conn } from './DB/connection.js'
import { seedAdmin } from './DB/Users/seedSuperAdmin.js'
import { migrateEnumsToArabic } from './DB/migrateEnumsToArabic.js'

dotenv.config()
const app = express()

app.use(cors())
const port = process.env.PORT

const start = async () => {
  await conn()
  await migrateEnumsToArabic()
  await seedAdmin()
  appRouter(app, express)
  app.listen(port, () => console.log(`Suits Cashier API listening on port ${port}`))
}

start().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
