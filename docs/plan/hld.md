# High-Level Design: Open The Port

## 1. Vision

**Open The Port** is a web-based, event-driven decision game built around systemic state evolution rather than fixed story branches.

- No "correct" answers
- No deterministic paths
- No fixed stage progression

Each action mutates the system state. The next event is selected probabilistically from events that satisfy the current state conditions.

The experience should feel: dynamic, systemic, pressure-driven, replayable, slightly chaotic but internally consistent.

---

## 2. Core Design Philosophy

1. State-driven progression — not scripted progression
2. Trade-offs, not right/wrong decisions
3. Emergent flow from numeric systems
4. Time pressure as primary tension driver
5. Fully data-driven event architecture
6. Expandable via Admin panel without code changes

---

## 3. Architecture Pattern

**Modular Monolith** — single deployable unit with strict internal domain boundaries.

**Rationale:**
- Game is fundamentally client-heavy; server is thin (persist scores, sync event config, serve auth)
- Microservices would be over-engineering for this scale
- Hexagonal architecture fits the engine (pure logic, swappable IO adapters)
- Event-driven internally (game loop), no distributed event bus needed yet

**Three deployment units:**
- **SPA** (React + Vite) — game UI, admin UI
- **API Server** (Bun + Hono) — REST, auth, leaderboard, event config CRUD
- **Database** (PostgreSQL) — users, scores, event configs

---

## 4. System Components

| Component | Responsibility |
|---|---|
| **Game Engine** (client) | Pure TS: stateManager, eventEngine, selectionEngine, cooldownManager |
| **React UI** (client) | GameView, AdminView, routing |
| **API Server** | Auth (JWT), /events CRUD, /scores, /leaderboard |
| **Auth Middleware** | JWT verification on protected routes (Admin, score submission) |
| **Event Config Store** | PostgreSQL table: events + actions + conditions as JSONB |
| **Score Store** | PostgreSQL table: runs, users, scores |
| **CDN / Static Host** | Serves SPA bundle |

---

## 5. Tech Stack

### Frontend
- React 18 + Vite + TypeScript
- Zustand — game state (lightweight, no boilerplate vs. Redux)
- React Router v6 — SPA routing incl. `/admin`
- TanStack Query — server state: leaderboard, event config sync

### Backend
- Bun runtime + Hono (ultra-lightweight, TypeScript-first, edge-compatible)
- Zod — runtime validation of event/action schemas
- jose — JWT (no heavy passport.js dependency)

### Database
- PostgreSQL 16 — JSONB for conditions/effects arrays; relational for users/scores
- Drizzle ORM — type-safe, migration-friendly, no magic

### Infrastructure
- Docker + Docker Compose — local dev
- Fly.io or Railway — API server (cheap, simple deploys)
- Vercel or Cloudflare Pages — SPA
- GitHub Actions — CI: typecheck, lint, test, deploy

### Why these over alternatives

| Choice | Alternative | Reason |
|---|---|---|
| Hono | Express | 3–10x faster, first-class TypeScript, edge-ready |
| Zustand | Redux | Game state is a single flat object — zero ceremony |
| PostgreSQL | MongoDB | JSONB for flexible conditions/effects + relational integrity for users/scores |
| Drizzle | Prisma | Lighter, raw SQL output, no Rust binary, plain SQL migrations |
| Bun | Node.js | Native TypeScript, faster startup, built-in watch mode |

---

## 6. File / Module Structure

```
/
├── apps/
│   ├── web/                    # React + Vite SPA
│   │   ├── src/
│   │   │   ├── engine/         # Pure TS, no React deps
│   │   │   │   ├── stateManager.ts
│   │   │   │   ├── eventEngine.ts
│   │   │   │   ├── selectionEngine.ts
│   │   │   │   └── cooldownManager.ts
│   │   │   ├── store/          # Zustand slices
│   │   │   │   ├── gameStore.ts
│   │   │   │   └── adminStore.ts
│   │   │   ├── ui/
│   │   │   │   ├── game/       # GameView, EventCard, StatusBar, EventLog
│   │   │   │   └── admin/      # AdminView, EventEditor, ConditionBuilder
│   │   │   ├── api/            # TanStack Query hooks + fetch wrappers
│   │   │   └── main.tsx
│   │   ├── index.html
│   │   └── vite.config.ts
│   │
│   └── api/                    # Hono API server (Bun runtime)
│       ├── src/
│       │   ├── routes/
│       │   │   ├── auth.ts
│       │   │   ├── events.ts   # CRUD for event configs
│       │   │   ├── scores.ts
│       │   │   └── leaderboard.ts
│       │   ├── middleware/
│       │   │   └── auth.ts     # JWT verification
│       │   ├── db/
│       │   │   ├── schema.ts   # Drizzle schema
│       │   │   └── migrations/
│       │   └── index.ts
│       └── Dockerfile
│
├── packages/
│   └── shared/                 # Shared TypeScript types (GameState, Event, Action, Effect)
│       └── src/
│           └── index.ts
│
├── docker-compose.yml
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── .github/workflows/ci.yml
```

---

## 7. Core Game Model

### 7.1 GameState

```ts
type GameState = {
  timeLeft:    number  // countdown timer (seconds)
  stress:      number  // 0–100
  privilege:   number  // 0–N
  bureaucracy: number  // 0–100
  security:    number  // 0–100
  influence:   number  // soft power modifier
  score:       number  // final run evaluation
}
```

No fixed phase. System behavior emerges from parameter ranges.

### 7.2 Run Initialization

At the start of each run:
- `timeLeft` initialized to 180 seconds
- `stress` set to baseline
- `privilege` starts at 1
- `bureaucracy`, `security`, `influence` seeded randomly within defined ranges
- Hidden environment modifiers generated (scale `effectiveWeight` per event)

### 7.3 Victory & Failure Conditions

**Win** — a terminal "Approval" event becomes eligible when:
- `privilege ≥ threshold`
- `security` within acceptable range
- `bureaucracy` not excessively high
- `timeLeft > 0`

Player selects an action from that event → run ends successfully.

**Lose** — any of:
- `timeLeft ≤ 0`
- `stress ≥ 100`
- `privilege ≤ 0`
- Critical terminal event triggered

---

## 8. Core Gameplay Loop

1. Event is displayed to the player
2. Player selects an Action
3. Action effects mutate `GameState`
4. Action cooldown activates — buttons disabled, progress indicator shown
5. Event Selection Engine runs
6. Next eligible Event is selected via weighted random
7. Repeat

> Time decreases continuously throughout the run, including during cooldown periods.

---

## 9. Event System

### 9.1 Event Structure

```ts
type Event = {
  id:          string
  title:       string
  description: string
  baseWeight:  number
  cooldown:    number       // seconds before this event can reappear
  conditions:  Condition[]  // all must pass for event to be eligible
  actions:     Action[]
}
```

### 9.2 Condition Model

Conditions are stored as structured data (required for admin panel and JSON persistence):

```ts
type Condition = {
  param: keyof GameState
  op:    '>' | '<' | '>=' | '<=' | '==' | '!='
  value: number
}
```

> Note: the design doc defines `Condition` as a function `(state: GameState) => boolean`. The structured form is equivalent at runtime but serializable — conditions are evaluated as `state[param] op value` and combined with AND logic.

Examples:
- `{ param: "stress", op: ">", value: 60 }`
- `{ param: "privilege", op: ">=", value: 2 }`
- `{ param: "timeLeft", op: "<", value: 30 }`

### 9.3 Action & Effect Structure

```ts
type Action = {
  id:          string
  label:       string
  effects:     Effect[]
  cooldown:    number   // seconds buttons are disabled after selecting
  scoreImpact: number
}

type Effect = {
  target: keyof GameState
  delta:  number
}
```

Actions do not determine the next event — they only mutate state.

### 9.4 Event Cooldown System

Each event has a `cooldown` (seconds or cycles). It cannot reappear until the cooldown expires. This prevents repetition loops.

---

## 10. Event Selection Algorithm

After each Action:

1. Filter eligible events: `events.filter(e => all conditions pass against current state)`
2. Remove events currently in cooldown
3. Compute effective weight: `effectiveWeight = baseWeight * stateModifier * environmentModifier`
4. Weighted random selection
5. Apply that event's cooldown

---

## 11. Scoring Model

Score accumulates throughout the run.

**Sources:**
- `scoreImpact` per action taken
- Surviving high stress (bonus for enduring stress > threshold)
- Fast resolution (time bonus for finishing early)
- High privilege end state

**Outcome tiers:**

| Score Range | Outcome |
|---|---|
| < 50 | Temporary Approval |
| 50–150 | Standard Approval |
| 150+ | Permanent Authorization |

Score affects post-run rating only — it does not feed back into `GameState` during the run.

---

## 12. Emergent Flow Model

The game naturally forms three phases — not scripted, but emergent from state drift:

### Early Game
- Low privilege, balanced parameters
- General events dominate the pool

### Mid Game
- One or more parameters drift toward extremes
- Pressure events enter the eligible pool

### Late Game
- Extreme parameter values
- High-risk / high-impact events dominate
- Terminal events become eligible

This is not scripted — it emerges from state.

---

## 13. Data Schemas

### events table (PostgreSQL)

```sql
CREATE TABLE events (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  base_weight INTEGER NOT NULL DEFAULT 10,
  cooldown    INTEGER NOT NULL DEFAULT 0,    -- seconds
  conditions  JSONB   NOT NULL DEFAULT '[]', -- [{param, op, value}]
  actions     JSONB   NOT NULL DEFAULT '[]', -- [{id, label, effects, cooldown, scoreImpact}]
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

### Condition JSON

```json
{ "param": "stress", "op": ">", "value": 60 }
```

### Action JSON

```json
{
  "id": "bribe",
  "label": "Pay the official",
  "effects": [
    { "target": "privilege", "delta": 1 },
    { "target": "stress",    "delta": 10 }
  ],
  "cooldown":    3,
  "scoreImpact": -5
}
```

### runs table (PostgreSQL)

```sql
CREATE TABLE runs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id),
  score      INTEGER NOT NULL,
  outcome    TEXT    NOT NULL,  -- 'win' | 'lose_time' | 'lose_stress' | 'lose_privilege'
  duration   INTEGER,           -- seconds
  started_at TIMESTAMPTZ,
  ended_at   TIMESTAMPTZ
);
```

---

## 14. Data Flow

```
[User Action]
     │
     ▼
[gameStore (Zustand)]
  applyAction(action)
     │
     ├─→ stateManager.applyEffects(state, effects)   → new GameState
     ├─→ cooldownManager.startCooldown(action.id)
     │
     ▼
[eventEngine.selectNext(state, events, cooldowns)]
  → filter eligible events
  → weighted random pick
     │
     ▼
[React re-renders EventCard]
     │
     └─→ [on run end] POST /api/scores  →  DB
```

---

## 15. UI Layout

### Game Screen

**Top Bar**
- Countdown Timer (primary visual anchor)
- Stress Bar
- Privilege Indicator
- Score

**Center Panel**
- Event Card: Title, Description, 2–4 Action Buttons
- During cooldown: buttons disabled, progress indicator visible

**Bottom / Side**
- Recent event log (last 5 state changes)

### Admin Screen (`/admin`)

**Left Panel**
- Event list
- Add Event button

**Right Panel**
- Event editor form (ID, Title, Description, Base Weight, Cooldown)
- Dynamic Conditions section (param + operator + value, AND-combined)
- Dynamic Actions section (label, effects, cooldown, score impact)
- Save / Delete buttons
- Import / Export JSON controls

---

## 16. Admin Simulation Tool *(optional)*

The admin panel may include a balancing tool:

- Simulate N runs (e.g., 100) against current event config
- Report event frequency distribution
- Report average score and outcome breakdown
- Detect runaway parameter growth (e.g., stress always hits 100 by second 60)

Used for content balancing without playing manually.

---

## 17. Scalability & Reliability

### Bottlenecks

1. Event selection is O(n) scan — fine for <1000 events; at scale, index conditions
2. Weighted random must handle ties and zero-weight events gracefully
3. Client-side timer drift — use `performance.now()` not `Date.now()` for accurate countdowns

### Growth Strategy

- SPA is static — scales infinitely via CDN
- API is stateless (JWT) — horizontal scaling is trivial behind a load balancer
- DB: PostgreSQL handles thousands of concurrent score writes; add read replica for leaderboard queries
- Event config is read-heavy, write-rare — cache in Redis (or Cloudflare KV) with TTL invalidation on admin save

### Reliability

- Game engine is pure functions → fully unit testable, no mocking needed
- Run state is ephemeral client-side → no distributed state problem
- Admin mutations are the only write-critical path → wrap in DB transactions

---

## 18. Replayability Drivers

- Randomized initial parameters per run
- State-driven event eligibility (no fixed sequence)
- Weighted event randomness
- Cooldown variance preventing repetition
- Score-based outcome tiers incentivising optimisation

---

## 19. Expansion Path

Future additions may include:

- Meta progression (unlocks, persistent upgrades)
- Difficulty modes
- Multiple environments (different parameter ranges / event pools)
- Global modifiers (per-run random mutators)
- Competitive leaderboard
- Narrative packs (event bundles as DLC-style content)

---

## 20. Constraints & Assumptions

- No real-time multiplayer in this phase
- Auth is optional for gameplay (guest runs allowed); required only for leaderboard submission
- Event config changes are low-frequency (admin use) — eventual consistency (cache TTL ~60s) is acceptable
- Score is self-reported from client — anti-cheat is out of scope for Phase 1
- Single language/locale (English) assumed; i18n not planned
