import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'

const app = new Hono()

app.use('*', logger())
app.use('/api/*', cors())

app.get('/', (c) => c.json({ status: 'ok', service: 'openport-api' }))

export default {
  port: 3000,
  fetch: app.fetch,
}
