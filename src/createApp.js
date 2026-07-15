import express from 'express'
import cors from 'cors'
import { appRouter } from './app.router.js'

/**
 * Build the Express application without listening or connecting to Mongo.
 * Used by production bootstrap and the automated test suite.
 */
export function createApp() {
  const app = express()
  app.use(cors())
  appRouter(app, express)
  return app
}
