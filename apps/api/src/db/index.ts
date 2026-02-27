import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { events } from './schema'

const sqlite = new Database('openport.sqlite')

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
    actions          TEXT NOT NULL DEFAULT '[]',
    created_by_csv   INTEGER,
    csv_number       INTEGER
  )
`)

// Migrate existing DBs that predate the csv columns
const cols = (sqlite.prepare('PRAGMA table_info(events)').all() as { name: string }[]).map(c => c.name)
if (!cols.includes('created_by_csv')) sqlite.exec('ALTER TABLE events ADD COLUMN created_by_csv INTEGER')
if (!cols.includes('csv_number'))     sqlite.exec('ALTER TABLE events ADD COLUMN csv_number INTEGER')

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
      createdByCsv:    null,
      csvNumber:       null,
    }).run()
  }

  console.log(`[db] Seeded ${eventsJson.length} events from events.json`)
}
