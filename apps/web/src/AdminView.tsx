import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Event, Action, Condition, Effect } from 'shared'
import './admin.css'

const API = '/api/events'

type GameStateKey = 'timeLeft' | 'stress' | 'privilege' | 'bureaucracy' | 'security' | 'influence' | 'score'
const STATE_KEYS: GameStateKey[] = ['timeLeft', 'stress', 'privilege', 'bureaucracy', 'security', 'influence', 'score']
const COND_OPS = ['>', '<', '>=', '<=', '==', '!='] as const

async function fetchEvents(): Promise<Event[]> {
  const res = await fetch(API)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function saveEvent(ev: Event, isNew: boolean): Promise<Event> {
  const url  = isNew ? API : `${API}/${ev.id}`
  const method = isNew ? 'POST' : 'PUT'
  const body = isNew ? ev : (({ id: _id, ...rest }) => rest)(ev)
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? res.statusText)
  }
  return res.json()
}

async function deleteEvent(id: string): Promise<void> {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

function emptyAction(): Action {
  return { id: crypto.randomUUID().slice(0, 8), label: '', effects: [], cooldown: 0, scoreImpact: 0 }
}

function emptyCondition(): Condition {
  return { param: 'stress', op: '>=', value: 0 }
}

function emptyEvent(): Event {
  return {
    id: '',
    title: '',
    description: '',
    baseWeight: 10,
    cooldown: 30,
    conditions: [],
    actions: [emptyAction()],
  }
}

// ── sub-components ─────────────────────────────────────────────────────────

function EffectRow({
  effect, onChange, onRemove,
}: { effect: Effect; onChange: (e: Effect) => void; onRemove: () => void }) {
  return (
    <div className="row-inline">
      <select value={effect.target} onChange={e => onChange({ ...effect, target: e.target.value as GameStateKey })}>
        {STATE_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
      </select>
      <input type="number" value={effect.delta}
        onChange={e => onChange({ ...effect, delta: Number(e.target.value) })} />
      <button className="btn-icon" onClick={onRemove} title="Remove effect">×</button>
    </div>
  )
}

function ActionEditor({
  action, onChange, onRemove,
}: { action: Action; onChange: (a: Action) => void; onRemove: () => void }) {
  function setField<K extends keyof Action>(k: K, v: Action[K]) {
    onChange({ ...action, [k]: v })
  }

  function updateEffect(i: number, e: Effect) {
    const effects = action.effects.map((ef, idx) => idx === i ? e : ef)
    setField('effects', effects)
  }

  function removeEffect(i: number) {
    setField('effects', action.effects.filter((_, idx) => idx !== i))
  }

  return (
    <div className="action-card">
      <div className="action-header">
        <span className="action-label">Action</span>
        <button className="btn-icon" onClick={onRemove} title="Remove action">×</button>
      </div>
      <div className="form-row">
        <label>ID</label>
        <input value={action.id} onChange={e => setField('id', e.target.value)} />
      </div>
      <div className="form-row">
        <label>Label</label>
        <input value={action.label} onChange={e => setField('label', e.target.value)} />
      </div>
      <div className="form-row">
        <label>Cooldown (s)</label>
        <input type="number" value={action.cooldown} onChange={e => setField('cooldown', Number(e.target.value))} />
        <label style={{ marginLeft: 12 }}>Score Impact</label>
        <input type="number" value={action.scoreImpact} onChange={e => setField('scoreImpact', Number(e.target.value))} />
      </div>
      <div className="sub-section">
        <span className="sub-label">Effects</span>
        {action.effects.map((ef, i) => (
          <EffectRow key={i} effect={ef} onChange={e => updateEffect(i, e)} onRemove={() => removeEffect(i)} />
        ))}
        <button className="btn-add" onClick={() => setField('effects', [...action.effects, { target: 'stress', delta: 0 }])}>
          + effect
        </button>
      </div>
    </div>
  )
}

function ConditionRow({
  cond, onChange, onRemove,
}: { cond: Condition; onChange: (c: Condition) => void; onRemove: () => void }) {
  return (
    <div className="row-inline">
      <select value={cond.param} onChange={e => onChange({ ...cond, param: e.target.value as GameStateKey })}>
        {STATE_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
      </select>
      <select value={cond.op} onChange={e => onChange({ ...cond, op: e.target.value as Condition['op'] })}>
        {COND_OPS.map(op => <option key={op} value={op}>{op}</option>)}
      </select>
      <input type="number" value={cond.value}
        onChange={e => onChange({ ...cond, value: Number(e.target.value) })} />
      <button className="btn-icon" onClick={onRemove} title="Remove condition">×</button>
    </div>
  )
}

// ── main editor ─────────────────────────────────────────────────────────────

function EventEditor({
  event, isNew, onSaved, onDeleted,
}: {
  event: Event
  isNew: boolean
  onSaved: (ev: Event) => void
  onDeleted: () => void
}) {
  const [ev, setEv] = useState<Event>(event)
  const [error, setError] = useState<string | null>(null)
  const qc = useQueryClient()

  // Sync when a different event is selected in the list
  const [lastId, setLastId] = useState(event.id)
  if (event.id !== lastId) {
    setEv(event)
    setLastId(event.id)
    setError(null)
  }

  const saveMutation = useMutation({
    mutationFn: () => saveEvent(ev, isNew),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['events'] })
      onSaved(saved)
      setError(null)
    },
    onError: (e: Error) => setError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteEvent(ev.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] })
      onDeleted()
    },
    onError: (e: Error) => setError(e.message),
  })

  function setField<K extends keyof Event>(k: K, v: Event[K]) {
    setEv(prev => ({ ...prev, [k]: v }))
  }

  function updateCondition(i: number, c: Condition) {
    setField('conditions', ev.conditions.map((x, idx) => idx === i ? c : x))
  }

  function updateAction(i: number, a: Action) {
    setField('actions', ev.actions.map((x, idx) => idx === i ? a : x))
  }

  return (
    <div className="editor-panel">
      <h2 className="panel-title">{isNew ? 'New Event' : 'Edit Event'}</h2>

      {error && <div className="error-banner">{error}</div>}

      <div className="form-row">
        <label>ID</label>
        <input value={ev.id} onChange={e => setField('id', e.target.value)} disabled={!isNew} />
      </div>
      <div className="form-row">
        <label>Title</label>
        <input value={ev.title} onChange={e => setField('title', e.target.value)} />
      </div>
      <div className="form-row">
        <label>Description</label>
        <textarea rows={3} value={ev.description} onChange={e => setField('description', e.target.value)} />
      </div>
      <div className="form-row">
        <label>Base Weight</label>
        <input type="number" value={ev.baseWeight} onChange={e => setField('baseWeight', Number(e.target.value))} />
        <label style={{ marginLeft: 12 }}>Cooldown (s)</label>
        <input type="number" value={ev.cooldown} onChange={e => setField('cooldown', Number(e.target.value))} />
      </div>
      <div className="form-row">
        <label>Terminal</label>
        <input type="checkbox" checked={!!ev.terminal}
          onChange={e => setField('terminal', e.target.checked || undefined)} />
        {ev.terminal && (
          <>
            <label style={{ marginLeft: 12 }}>Outcome</label>
            <select value={ev.terminalOutcome ?? ''}
              onChange={e => setField('terminalOutcome', e.target.value as 'win' | 'lose' || undefined)}>
              <option value="">—</option>
              <option value="win">win</option>
              <option value="lose">lose</option>
            </select>
          </>
        )}
      </div>

      <div className="sub-section">
        <span className="sub-label">Conditions</span>
        {ev.conditions.map((c, i) => (
          <ConditionRow key={i} cond={c} onChange={c2 => updateCondition(i, c2)}
            onRemove={() => setField('conditions', ev.conditions.filter((_, idx) => idx !== i))} />
        ))}
        <button className="btn-add" onClick={() => setField('conditions', [...ev.conditions, emptyCondition()])}>
          + condition
        </button>
      </div>

      <div className="sub-section">
        <span className="sub-label">Actions</span>
        {ev.actions.map((a, i) => (
          <ActionEditor key={i} action={a} onChange={a2 => updateAction(i, a2)}
            onRemove={() => setField('actions', ev.actions.filter((_, idx) => idx !== i))} />
        ))}
        <button className="btn-add" onClick={() => setField('actions', [...ev.actions, emptyAction()])}>
          + action
        </button>
      </div>

      <div className="editor-footer">
        <button className="btn-save" onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving…' : 'Save'}
        </button>
        {!isNew && (
          <button className="btn-delete" onClick={() => {
            if (confirm(`Delete "${ev.title}"?`)) deleteMutation.mutate()
          }} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── admin shell ─────────────────────────────────────────────────────────────

export function AdminView() {
  const { data: events, isLoading, error } = useQuery<Event[]>({
    queryKey: ['events'],
    queryFn: fetchEvents,
  })

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isNew, setIsNew] = useState(false)

  const selected = events?.find(e => e.id === selectedId) ?? null

  function handleNew() {
    setSelectedId(null)
    setIsNew(true)
  }

  function handleSelect(id: string) {
    setSelectedId(id)
    setIsNew(false)
  }

  function handleSaved(ev: Event) {
    setSelectedId(ev.id)
    setIsNew(false)
  }

  function handleDeleted() {
    setSelectedId(null)
    setIsNew(false)
  }

  const editorEvent = isNew ? emptyEvent() : selected

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <h1>Open The Port — Admin</h1>
        <a href="/" className="back-link">← Game</a>
      </header>

      <div className="admin-body">
        {/* Left panel: event list */}
        <aside className="event-list">
          <button className="btn-new" onClick={handleNew}>+ New Event</button>
          {isLoading && <p className="status">Loading…</p>}
          {error   && <p className="status error">Failed to load events</p>}
          {events?.map(ev => (
            <button
              key={ev.id}
              className={`event-item ${selectedId === ev.id ? 'active' : ''}`}
              onClick={() => handleSelect(ev.id)}
            >
              <span className="event-item-title">{ev.title}</span>
              <span className="event-item-id">{ev.id}</span>
            </button>
          ))}
        </aside>

        {/* Right panel: editor */}
        <main className="editor-area">
          {editorEvent ? (
            <EventEditor
              key={isNew ? '__new__' : selectedId!}
              event={editorEvent}
              isNew={isNew}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
            />
          ) : (
            <div className="editor-placeholder">
              Select an event to edit, or click <strong>+ New Event</strong>.
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
