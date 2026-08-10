import express from 'express'
import dotenv from 'dotenv'
import { createApp } from './src/createApp.js'
import { conn } from './DB/connection.js'
import { seedAdmin } from './DB/Users/seedSuperAdmin.js'
import { migrateEnumsToArabic } from './DB/migrateEnumsToArabic.js'
import { migrateProductBarcodes } from './DB/migrateProductBarcodes.js'

dotenv.config()

const port = process.env.PORT

const start = async () => {
  await conn()
  await migrateEnumsToArabic()
  await migrateProductBarcodes()
  await seedAdmin()

  const app = createApp()
  app.listen(port, () =>
    console.log(`Suits Cashier API listening on port ${port}`)
  )
}

start().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
