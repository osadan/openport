import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
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
  id:              z.string(),
  title:           z.string(),
  description:     z.string(),
  baseWeight:      z.number(),
  cooldown:        z.number(),
  terminal:        z.boolean().optional(),
  terminalOutcome: z.enum(['win', 'lose']).optional(),
  conditions:      z.array(ConditionSchema).default([]),
  actions:         z.array(ActionSchema),
})

function rowToEvent(row: typeof events.$inferSelect) {
  return {
    id:              row.id,
    title:           row.title,
    description:     row.description,
    baseWeight:      row.baseWeight,
    cooldown:        row.cooldown,
    terminal:        row.terminal ?? undefined,
    terminalOutcome: (row.terminalOutcome as 'win' | 'lose' | undefined) ?? undefined,
    conditions:      JSON.parse(row.conditions),
    actions:         JSON.parse(row.actions),
  }
}

export const eventsRouter = new Hono()

// GET /api/events — list all
eventsRouter.get('/', (c) => {
  const rows = db.select().from(events).all()
  return c.json(rows.map(rowToEvent))
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
