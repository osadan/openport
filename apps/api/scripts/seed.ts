#!/usr/bin/env bun
/**
 * Seed script — wipes the events table and re-populates it from events.json.
 * Run: bun apps/api/scripts/seed.ts   (from monorepo root)
 *   or: bun scripts/seed.ts           (from apps/api/)
 *
 * Safe to run on every deploy — idempotent via DELETE + re-insert.
 */

import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { events } from '../src/db/schema'

const DB_PATH = new URL('../openport.sqlite', import.meta.url).pathname

const sqlite = new Database(DB_PATH)
sqlite.exec('PRAGMA journal_mode = WAL;')
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id               TEXT PRIMARY KEY,
    title            TEXT NOT NULL,
    description      TEXT NOT NULL,
    base_weight      INTEGER NOT NULL,
    cooldown         INTEGER NOT NULL,
    terminal         INTEGER,
    terminal_outcome TEXT,
    conditions       TEXT NOT NULL DEFAULT '[]',
    actions          TEXT NOT NULL DEFAULT '[]'
  )
`)

const db = drizzle(sqlite)

const eventsJsonPath = new URL(
  '../../../apps/web/src/data/events.json',
  import.meta.url,
).pathname

const eventsJson = await Bun.file(eventsJsonPath).json()

// Wipe and re-seed
db.delete(events).run()

for (const ev of eventsJson) {
  db.insert(events).values({
    id:              ev.id,
    title:           ev.title,
    description:     ev.description,
    baseWeight:      ev.baseWeight,
    cooldown:        ev.cooldown,
    terminal:        ev.terminal ?? null,
    terminalOutcome: ev.terminalOutcome ?? null,
    conditions:      JSON.stringify(ev.conditions ?? []),
    actions:         JSON.stringify(ev.actions ?? []),
  }).run()
}

console.log(`✓ Seeded ${eventsJson.length} events into ${DB_PATH}`)
sqlite.close()
