import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import { seedIfEmpty } from './db'
import { eventsRouter } from './routes/events'

const app = new Hono()

app.use('*', logger())
app.use('/api/*', cors())

app.get('/', (c) => c.json({ status: 'ok', service: 'openport-api' }))
app.route('/api/events', eventsRouter)

// Seed DB before serving first request
await seedIfEmpty()

export default {
  port: 3000,
  fetch: app.fetch,
}
