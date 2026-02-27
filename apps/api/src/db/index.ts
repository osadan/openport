import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { events } from './schema'

const sqlite = new Database('openport.sqlite')

// Enable WAL mode for better concurrency
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

export const db = drizzle(sqlite)

export async function seedIfEmpty() {
  const existing = db.select().from(events).all()
  if (existing.length > 0) return

  const eventsPath = new URL('../../../../apps/web/src/data/events.json', import.meta.url)
  const file = Bun.file(eventsPath.pathname)
  const eventsJson = await file.json()

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

  console.log(`[db] Seeded ${eventsJson.length} events from events.json`)
}
