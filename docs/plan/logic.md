# Open The Port — Game Logic

How the game engine actually works, from button click to next event.

---

## 1. State Variables

Everything the game tracks lives in `GameState`:

| Field | Range | Meaning |
|---|---|---|
| `timeLeft` | 0 – 180 | Seconds remaining in the run. Ticks down continuously. |
| `stress` | 0 – 100 | Mental load. Lose at 100. |
| `privilege` | 0 – N | Political capital. Lose at 0. Win gate requires ≥ 5. |
| `bureaucracy` | 0 – 100 | Process overhead. Lose (terminal) at 90. Win gate requires ≤ 70. |
| `security` | 0 – 100 | Scrutiny level. Lose (terminal) at 85. Win gate requires ≤ 70. |
| `influence` | 0 – N | Unlocks late-game events. Not directly a win/lose axis. |
| `score` | 0 – N | Accumulates from `scoreImpact` on each action. Post-run rating only. |

`timeLeft` can be gained back — three events (`deadline-extended`, `manager-buys-time`, `network-slot-opened`) have actions with a positive `timeLeft` delta. This is intentional: skilled play that keeps bureaucracy low or builds privilege unlocks breathing room.

`stress`, `bureaucracy`, and `security` are clamped to `[0, 100]`. `privilege` and `timeLeft` are clamped to `[0, ∞)`.

---

## 2. Core Loop

```
startRun()
   │
   ▼
[randomise initial state]  ←── initRanges from config.json
   │
   ▼
[generate envModifiers]   ←── random [0.8, 1.2] per event, fixed for the run
   │
   ▼
selectNextEvent() ──────────────────────────────────────────┐
   │                                                        │
   ▼                                                        │
[display EventCard to player]                               │
   │                                                        │
   ▼  (player clicks an action)                            │
pickAction(action, event)                                   │
   │                                                        │
   ├─ applyAndClamp(effects + scoreImpact)                  │
   ├─ startActionCooldown(action.id, action.cooldown)       │
   ├─ startEventCooldown(event.id,   event.cooldown)        │
   │                                                        │
   ├─ checkRunOutcome() ──► non-null? ──► phase = 'over'    │
   │                                                        │
   └─ selectNextEvent() ─────────────────────────────────── ┘
          │
          ▼
   null? tick() retries each second until a cooldown expires
```

Time runs independently via `setInterval(tick, 1000)` in `App.tsx`. Each tick:
- Decrements `timeLeft` by 1
- Checks lose conditions
- If `currentEvent` is null, retries `selectNextEvent` (fixes the "no events" freeze)

---

## 3. Event Selection

**Step 1 — Filter eligible events**

An event is eligible if:
1. All its `conditions` pass against the current `GameState`
2. It is **not** on cooldown (`now < expiry` in `CooldownState.events`)

```ts
// engine/selectionEngine.ts
evaluateCondition(state, { param, op, value })
// e.g. { param: 'security', op: '>=', value: 40 }
// → state.security >= 40
```

Conditions use AND logic — all must pass.

**Step 2 — Compute weights**

```
effectiveWeight = event.baseWeight × stateModifier × envModifier
```

- `stateModifier` = 1.0 (Phase 1 — hook for future state-based tuning)
- `envModifier` = random value in `[0.8, 1.2]`, generated once per run → makes the same event feel different each run even with identical state

**Step 3 — Weighted random pick**

```
total = sum of all effectiveWeights
roll  = random() × total
iterate events, subtract weight until roll ≤ 0 → that event is selected
```

Zero-weight events are skipped. Empty eligible list → returns `null`.

---

## 4. Cooldown System

Cooldowns use **wall-clock expiry timestamps**, not remaining durations.

```
expiry = Date.now() + durationSec × 1000
```

Stored in `CooldownState`:
```ts
{ events:  { "port-scan-alert": 1716000030000 },
  actions: { "port-scan-alert-harden": 1716000036000 } }
```

Two separate cooldowns are set when a player acts:
- **Event cooldown** — prevents the same event from appearing again for `event.cooldown` seconds
- **Action cooldown** — prevents the same action button from being re-used (relevant if the same event recurs)

Since time is a real-time clock (`Date.now()`), cooldowns expire naturally with no tick function needed. The selection engine just checks `now < expiry`.

---

## 5. Effects Model

Each action carries an `effects` array plus a scalar `scoreImpact`:

```ts
action.effects    = [{ target: 'security', delta: -15 }, { target: 'timeLeft', delta: -20 }]
action.scoreImpact = 12
```

`applyAction` in `eventEngine.ts` folds `scoreImpact` into the effects list as `{ target: 'score', delta: scoreImpact }` before calling `applyAndClamp`.

`clampState` enforces bounds after every mutation:
- `stress`, `bureaucracy`, `security` → clamped to `[0, 100]`
- `privilege`, `timeLeft` → clamped to `[0, ∞)`

---

## 6. Win / Lose Conditions

Checked in `checkRunOutcome(state, selectedEvent?)` after every action and every tick.

```
checkRunOutcome
   │
   ├─ state.timeLeft  ≤ 0   → 'time'
   ├─ state.stress    ≥ 100 → 'stress'
   ├─ state.privilege ≤ 0   → 'privilege'
   │
   └─ selectedEvent?.terminal
        ├─ terminalOutcome === 'win'  → 'win'
        └─ terminalOutcome === 'lose' → 'critical'
```

Terminal events are selected by the normal weighted-random algorithm — they just happen to also end the run when the player picks any action from them. No special casing in the selection step.

**Win event** (`port-open`) becomes eligible when:
```
privilege ≥ 5  AND  security ≤ 70  AND  bureaucracy ≤ 70  AND  timeLeft > 0
```

**Lose terminals**:
- `port-blocked`    → eligible when `security ≥ 85`
- `ticket-expired`  → eligible when `bureaucracy ≥ 90`

---

## 7. Data Flow Diagram

```
                        ┌─────────────────────────────────────────────┐
                        │              Zustand Store                  │
                        │                                             │
  events.json ─────────►│  ALL_EVENTS[]    envModifiers{}             │
  config.json ─────────►│  (fixed per run) (fixed per run)            │
                        │                                             │
                        │  gameState       cooldowns                  │
                        │  currentEvent    outcome                    │
                        │  log             phase                      │
                        └──────────┬──────────────────────────────────┘
                                   │
              ┌────────────────────┼───────────────────────┐
              │                    │                       │
              ▼                    ▼                       ▼
       startRun()           pickAction()               tick()
              │                    │                       │
              │            ┌───────┴──────┐               │ every 1s
              │            │              │               │ (setInterval)
              ▼            ▼              ▼               ▼
       initState()   engineApplyAction  checkRunOutcome  timeLeft--
                           │              │               │
                     ┌─────┴────┐         │            (if currentEvent
                     │          │    'over'→phase        is null)
               applyAndClamp  cooldowns                   │
                     │          │                         ▼
                     ▼          ▼                 selectNextEvent()
              selectNextEvent() ──────────────────────────┘
                     │
              ┌──────┴──────────────────────────────────┐
              │  selectionEngine                        │
              │                                         │
              │  1. filter: evaluateConditions(state)   │
              │  2. filter: !isEventOnCooldown(cd, now) │
              │  3. weight: baseW × stateM × envM       │
              │  4. pick:   weightedRandomPick()        │
              └─────────────────────────────────────────┘
                     │
                     ▼
              Event | null ──► currentEvent in store ──► EventCard in UI
```

---

## 8. Module Responsibilities

| File | Responsibility |
|---|---|
| `engine/stateManager.ts` | Pure state mutations: `applyEffects`, `clampState`, `checkLoseCondition` |
| `engine/cooldownManager.ts` | Read/write cooldown timestamps. No game logic. |
| `engine/selectionEngine.ts` | Condition evaluation, weight computation, weighted random pick |
| `engine/eventEngine.ts` | Orchestrator: wires the other three into `applyAction` and `selectNextEvent` |
| `store.ts` | Zustand store. Holds all runtime state. Calls engine functions. |
| `App.tsx` | Mounts the 1-second timer. Renders `<GameView>`. |
| `GameView.tsx` | All React UI. Reads store, calls `pickAction`. |
| `data/events.json` | Event definitions — the only file that needs changing to add/edit game content |
| `data/config.json` | Win thresholds, initial state ranges, score tiers |
| `packages/shared/src/index.ts` | Shared TypeScript types (no logic) |

---

## 9. Why Events Went Missing (Bug)

`pickAction` calls `selectNextEvent` synchronously with `Date.now()`. Event cooldowns are also stamped with `Date.now()`. So the event just played is on cooldown for `event.cooldown` real seconds (25–35s for early events).

If a player clicks rapidly through all 7 always-eligible events, all are simultaneously on cooldown and `selectNextEvent` returns `null` → `currentEvent = null`.

The old `tick()` only decremented time — it never retried selection. The fix: `tick()` now calls `selectNextEvent` on every tick when `currentEvent` is null, so the game unblocks within ≤1 second after any cooldown expires.
