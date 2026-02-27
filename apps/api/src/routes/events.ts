import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db'
import { events } from '../db/schema'

const EffectSchema = z.object({
  target: z.enum(['timeLeft', 'stress', 'privilege', 'bureaucracy', 'security', 'influence', 'score']),
  delta:  z.number(),
})

const ActionSchema = z.object({
  id:          z.string(),
  label:       z.string(),
  effects:     z.array(EffectSchema),
  cooldown:    z.number(),
  scoreImpact: z.number(),
})

const ConditionSchema = z.object({
  param: z.enum(['timeLeft', 'stress', 'privilege', 'bureaucracy', 'security', 'influence', 'score']),
  op:    z.enum(['>', '<', '>=', '<=', '==', '!=']),
  value: z.number(),
})

const EventSchema = z.object({
  id:              z.string().min(1).regex(/^[a-z0-9-_]+$/, 'ID must be lowercase letters, numbers, hyphens or underscores'),
  title:           z.string().min(1),
  description:     z.string().min(1),
  baseWeight:      z.number().positive(),
  cooldown:        z.number().min(0),
  terminal:        z.boolean().optional(),
  terminalOutcome: z.enum(['win', 'lose']).optional(),
  conditions:      z.array(ConditionSchema).default([]),
  actions:         z.array(ActionSchema),
  createdByCsv:    z.boolean().optional(),
  csvNumber:       z.number().int().optional(),
})

function safeParse<T>(json: string, fallback: T): T {
  try { return JSON.parse(json) } catch { return fallback }
}

function rowToEvent(row: typeof events.$inferSelect) {
  return {
    id:              row.id,
    title:           row.title,
    description:     row.description,
    baseWeight:      row.baseWeight,
    cooldown:        row.cooldown,
    terminal:        row.terminal ?? undefined,
    terminalOutcome: (row.terminalOutcome as 'win' | 'lose' | undefined) ?? undefined,
    conditions:      safeParse(row.conditions, []),
    actions:         safeParse(row.actions, []),
    createdByCsv:    row.createdByCsv ?? undefined,
    csvNumber:       row.csvNumber ?? undefined,
  }
}

export const eventsRouter = new Hono()

// GET /api/events — list all
eventsRouter.get('/', (c) => {
  const rows = db.select().from(events).all()
  return c.json(rows.map(rowToEvent))
})

// GET /api/events/csv-imports — list distinct CSV batches with event counts
eventsRouter.get('/csv-imports', (c) => {
  const rows = db
    .select({
      csvNumber: events.csvNumber,
      count: sql<number>`count(*)`,
    })
    .from(events)
    .where(sql`csv_number IS NOT NULL`)
    .groupBy(events.csvNumber)
    .orderBy(events.csvNumber)
    .all()

  return c.json(rows.map(r => ({ csvNumber: r.csvNumber, count: r.count })))
})

// DELETE /api/events/csv/:number — delete all events from a specific CSV import
eventsRouter.delete('/csv/:number', (c) => {
  const num = Number(c.req.param('number'))
  if (!Number.isInteger(num)) return c.json({ error: 'Invalid csv number' }, 400)

  const deleted = db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.csvNumber, num))
    .all()

  db.delete(events).where(eq(events.csvNumber, num)).run()

  return c.json({ ok: true, deleted: deleted.length })
})

// GET /api/events/:id — single event
eventsRouter.get('/:id', (c) => {
  const row = db.select().from(events).where(eq(events.id, c.req.param('id'))).get()
  if (!row) return c.json({ error: 'Not found' }, 404)
  return c.json(rowToEvent(row))
})

// POST /api/events — create
eventsRouter.post('/', zValidator('json', EventSchema), (c) => {
  const ev = c.req.valid('json')
  const existing = db.select().from(events).where(eq(events.id, ev.id)).get()
  if (existing) return c.json({ error: 'Event with this id already exists' }, 409)

  db.insert(events).values({
    id:              ev.id,
    title:           ev.title,
    description:     ev.description,
    baseWeight:      ev.baseWeight,
    cooldown:        ev.cooldown,
    terminal:        ev.terminal ?? null,
    terminalOutcome: ev.terminalOutcome ?? null,
    conditions:      JSON.stringify(ev.conditions),
    actions:         JSON.stringify(ev.actions),
    createdByCsv:    ev.createdByCsv ?? null,
    csvNumber:       ev.csvNumber ?? null,
  }).run()

  const row = db.select().from(events).where(eq(events.id, ev.id)).get()!
  return c.json(rowToEvent(row), 201)
})

// PUT /api/events/:id — full replace
eventsRouter.put('/:id', zValidator('json', EventSchema.omit({ id: true })), (c) => {
  const id = c.req.param('id')
  const ev = c.req.valid('json')

  const existing = db.select().from(events).where(eq(events.id, id)).get()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  db.update(events).set({
    title:           ev.title,
    description:     ev.description,
    baseWeight:      ev.baseWeight,
    cooldown:        ev.cooldown,
    terminal:        ev.terminal ?? null,
    terminalOutcome: ev.terminalOutcome ?? null,
    conditions:      JSON.stringify(ev.conditions),
    actions:         JSON.stringify(ev.actions),
    createdByCsv:    ev.createdByCsv ?? null,
    csvNumber:       ev.csvNumber ?? null,
  }).where(eq(events.id, id)).run()

  const row = db.select().from(events).where(eq(events.id, id)).get()!
  return c.json(rowToEvent(row))
})

// DELETE /api/events/:id
eventsRouter.delete('/:id', (c) => {
  const id = c.req.param('id')
  const existing = db.select().from(events).where(eq(events.id, id)).get()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  db.delete(events).where(eq(events.id, id)).run()
  return c.json({ ok: true })
})
