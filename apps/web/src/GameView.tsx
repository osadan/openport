import './game.css'
import type { Event, Action, GameState, CooldownState } from 'shared'
import { useGameStore } from './store'
import { isActionOnCooldown } from './engine/cooldownManager'
import configRaw from './data/config.json'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const config = configRaw as any

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

function timerClass(t: number) {
  if (t > 60) return 'topbar__timer topbar__timer--ok'
  if (t > 30) return 'topbar__timer topbar__timer--warn'
  return 'topbar__timer topbar__timer--crit'
}

function barColor(pct: number) {
  if (pct < 40) return 'var(--green)'
  if (pct < 70) return 'var(--yellow)'
  return 'var(--red)'
}

function scoreLabel(score: number): string {
  const tiers: { label: string; min: number }[] = config.scoreTiers
  for (let i = tiers.length - 1; i >= 0; i--)
    if (score >= tiers[i].min) return tiers[i].label
  return tiers[0].label
}

function outcomeInfo(outcome: string): { win: boolean; headline: string; sub: string } {
  switch (outcome) {
    case 'win':      return { win: true,  headline: 'PORT IS OPEN',            sub: 'CHG0042731 closed — Successfully Implemented.' }
    case 'time':     return { win: false, headline: 'WINDOW EXPIRED',          sub: 'The ticket aged out. The port stays closed.' }
    case 'stress':   return { win: false, headline: 'BURNT OUT',               sub: 'Decision fatigue. The ticket was abandoned.' }
    case 'privilege':return { win: false, headline: 'REQUEST WITHDRAWN',       sub: 'Support collapsed. CHG0042731 closed — Rejected.' }
    case 'critical': return { win: false, headline: 'PORT PERMANENTLY BLOCKED',sub: 'The change was denied. The rule was never written.' }
    default:         return { win: false, headline: 'RUN ENDED', sub: '' }
  }
}

// ─── stat bar ────────────────────────────────────────────────────────────────

function StatBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <div className="stat__track">
        <div className="stat__fill" style={{ width: `${pct}%`, background: barColor(pct) }} />
      </div>
      <span className="stat__num">{Math.round(value)}</span>
    </div>
  )
}

// ─── top bar ─────────────────────────────────────────────────────────────────

function TopBar({ gs }: { gs: GameState }) {
  return (
    <div className="topbar">
      <div className="topbar__row1">
        <span className="topbar__ticket"><b>CHG0042731</b> · IN PROGRESS</span>
        <div className={timerClass(gs.timeLeft)}>{formatTime(gs.timeLeft)}</div>
        <div className="topbar__right">
          <div className="topbar__kv">
            <span className="topbar__kv-label">Privilege</span>
            <span className="topbar__kv-val topbar__kv-val--blue">{gs.privilege}</span>
          </div>
          <div className="topbar__kv">
            <span className="topbar__kv-label">Score</span>
            <span className="topbar__kv-val topbar__kv-val--yellow">{gs.score}</span>
          </div>
        </div>
      </div>
      <div className="topbar__stats">
        <StatBar label="Stress"      value={gs.stress} />
        <StatBar label="Security"    value={gs.security} />
        <StatBar label="Bureaucracy" value={gs.bureaucracy} />
      </div>
    </div>
  )
}

// ─── action button ────────────────────────────────────────────────────────────

function ActionBtn({
  action, cooldowns, onPick,
}: { action: Action; cooldowns: CooldownState; onPick: (a: Action) => void }) {
  const disabled = isActionOnCooldown(cooldowns, action.id, Date.now())
  const imp = action.scoreImpact
  const scoreClass = imp > 0 ? 'score--pos' : imp < 0 ? 'score--neg' : 'score--zero'
  const scoreText  = imp > 0 ? `+${imp}` : `${imp}`

  return (
    <button className="action-btn" disabled={disabled} onClick={() => onPick(action)}>
      <span className="action-btn__label">{action.label}</span>
      {imp !== 0 && (
        <span className={`action-btn__score ${scoreClass}`}>{scoreText} pts</span>
      )}
      <span className="action-btn__arrow">→</span>
    </button>
  )
}

// ─── event card ───────────────────────────────────────────────────────────────

function EventCard({
  event, cooldowns, onPick,
}: { event: Event; cooldowns: CooldownState; onPick: (a: Action, e: Event) => void }) {
  const cardClass = event.terminal
    ? `event-card event-card--${event.terminalOutcome === 'win' ? 'win' : 'lose'}`
    : 'event-card'

  return (
    <div className={cardClass}>
      {event.terminal && (
        <div className={`event-card__tag event-card__tag--${event.terminalOutcome === 'win' ? 'win' : 'lose'}`}>
          {event.terminalOutcome === 'win' ? '● Terminal — Win' : '● Terminal — Critical'}
        </div>
      )}
      <div className="event-card__title">{event.title}</div>
      <div className="event-card__sep" />
      <div className="event-card__desc">{event.description}</div>
      <div className="actions">
        {event.actions.map(a => (
          <ActionBtn key={a.id} action={a} cooldowns={cooldowns} onPick={a => onPick(a, event)} />
        ))}
      </div>
    </div>
  )
}

// ─── log ─────────────────────────────────────────────────────────────────────

function Log({ entries }: { entries: string[] }) {
  if (!entries.length) return null
  return (
    <div className="log">
      <div className="log__head">Event Log</div>
      {entries.slice(0, 5).map((e, i) => {
        const isAction = e.startsWith('> ')
        return (
          <div key={i} className={`log__entry log__entry--${i}`}>
            <span className={isAction ? 'pfx-action' : 'pfx-event'}>
              {isAction ? '›' : '·'}
            </span>
            <span>{isAction ? e.slice(2) : e}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── screens ──────────────────────────────────────────────────────────────────

function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="screen">
      <div className="screen__card">
        <div className="start__eye">Enterprise Change Management</div>
        <div className="start__logo">OPEN THE <em>PORT</em></div>
        <div className="divider" />
        <div className="start__desc">
          Navigate corporate bureaucracy, security reviews, and approval chains
          to get your firewall change implemented before time runs out.
        </div>
        <div className="start__terminal">
          <div><span className="t-cmd">$</span> telnet <span className="t-addr">192.168.1.50 8443</span></div>
          <div><span className="t-err">Trying 192.168.1.50...</span></div>
          <div><span className="t-err">Connection refused.</span></div>
          <div><span className="t-cmd">$</span> <span className="t-cursor" /></div>
        </div>
        <button className="btn" onClick={onStart}>Open Ticket CHG0042731</button>
      </div>
    </div>
  )
}

function OutcomeScreen({ outcome, score, onRestart }: { outcome: string; score: number; onRestart: () => void }) {
  const { win, headline, sub } = outcomeInfo(outcome)
  const terminal = win
    ? [
        '$ telnet 192.168.1.50 8443',
        'Trying 192.168.1.50...',
        'Connected to 192.168.1.50.',
        "Escape character is '^]'.",
      ]
    : [
        '$ telnet 192.168.1.50 8443',
        'Trying 192.168.1.50...',
        'Connection refused.',
      ]

  return (
    <div className="screen">
      <div className="screen__card">
        <div className={`outcome__badge outcome__badge--${win ? 'win' : 'lose'}`}>
          {win ? 'Success' : 'Failure'}
        </div>
        <div className="outcome__headline">{headline}</div>
        <div className="outcome__sub">{sub}</div>

        <div className="start__terminal" style={{ textAlign: 'left' }}>
          {terminal.map((line, i) => (
            <div key={i}>
              {i === 0
                ? <><span className="t-cmd">$</span> {line.slice(2)}</>
                : <span className={win || i < 2 ? undefined : 't-err'}>{line}</span>
              }
            </div>
          ))}
        </div>

        <div className="divider" />
        <div className="outcome__score-wrap">
          <div className="outcome__score">{score}</div>
          <div className="outcome__tier">{scoreLabel(score)}</div>
        </div>
        <button className="btn" onClick={onRestart}>New Run</button>
      </div>
    </div>
  )
}

// ─── root ─────────────────────────────────────────────────────────────────────

export function GameView() {
  const { phase, gameState, cooldowns, currentEvent, outcome, log, startRun, pickAction } =
    useGameStore()

  if (phase === 'idle') return <StartScreen onStart={startRun} />
  if (phase === 'over') return (
    <OutcomeScreen outcome={outcome!} score={gameState.score} onRestart={startRun} />
  )

  return (
    <div className="game-body">
      <TopBar gs={gameState} />
      <div className="game-content">
        {currentEvent
          ? <EventCard event={currentEvent} cooldowns={cooldowns} onPick={pickAction} />
          : <div className="no-event">waiting for eligible events…</div>}
        <Log entries={log} />
      </div>
    </div>
  )
}
