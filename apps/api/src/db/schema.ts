import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const events = sqliteTable('events', {
  id:              text('id').primaryKey(),
  title:           text('title').notNull(),
  description:     text('description').notNull(),
  baseWeight:      integer('base_weight').notNull(),
  cooldown:        integer('cooldown').notNull(),
  terminal:        integer('terminal', { mode: 'boolean' }),
  terminalOutcome: text('terminal_outcome'),
  conditions:      text('conditions').notNull().default('[]'),
  actions:         text('actions').notNull().default('[]'),
  createdByCsv:    integer('created_by_csv', { mode: 'boolean' }),
  csvNumber:       integer('csv_number'),
})
