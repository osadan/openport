# Plan: High-Level Design Document for Open The Port

## Context
The user has a game design doc (`docs/plan/first_design.md`) for "Open The Port" — a web-based, event-driven decision game. No code exists yet. They want a production-ready HLD written to `docs/plan/`. Deployment target: **SPA + lightweight backend**. Frontend: **React + Vite**. Scope: architecture, tech stack with justifications, file/module structure, scalability & reliability, data schemas.

---

## Output File
`docs/plan/hld.md`

---

## Document Structure

### 1. Architecture Pattern
**Modular Monolith** (single deployable unit, strict internal domain boundaries).

Rationale:
- Game is fundamentally client-heavy; server is thin (persist scores, sync event config, serve auth)
- Microservices would be over-engineering for this scale
- Hexagonal architecture fits the engine (pure logic, swappable IO adapters)
- Event-Driven internally (game loop), not distributed event bus needed yet

Three deployment units:
- **SPA** (React + Vite) — game UI, admin UI
- **API Server** (Node.js + Hono) — REST, auth, leaderboard, event config CRUD
- **Database** (PostgreSQL) — users, scores, event configs

---

### 2. System Components

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

### 3. Tech Stack

**Frontend**
- React 18 + Vite + TypeScript
- Zustand (game state — lightweight, no boilerplate vs. Redux)
- React Router v6 (SPA routing incl. /admin)
- TanStack Query (server state: leaderboard, event config sync)

**Backend**
- Node.js 22 LTS + Hono (ultra-lightweight, TypeScript-first, edge-compatible)
- Zod (runtime validation of event/action schemas)
- jose (JWT — no heavy passport.js dependency)

**Database**
- PostgreSQL 16 (JSONB for conditions/effects arrays; relational for users/scores)
- Drizzle ORM (type-safe, migration-friendly, no magic)

**Infrastructure**
- Docker + Docker Compose (local dev)
- Fly.io or Railway (API server — cheap, simple deploys)
- Vercel or Cloudflare Pages (SPA)
- GitHub Actions (CI: typecheck, lint, test, deploy)

**Why these over alternatives:**
- Hono vs Express: 3–10x faster, first-class TypeScript, edge-ready if we ever move
- Zustand vs Redux: game state is a single flat object — Zustand has zero ceremony
- PostgreSQL vs MongoDB: event conditions/effects are JSONB arrays (flexible) but users/scores need relational integrity; JSONB gives best of both
- Drizzle vs Prisma: lighter, generates raw SQL, no Rust binary, migration files are plain SQL

---

### 4. File / Module Structure

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
│   │   └── vite.config.ts
│   │
│   └── api/                    # Hono API server
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
│
├── docker-compose.yml
└── .github/workflows/ci.yml
```

---

### 5. Data Schemas

**GameState** (client-only, not persisted mid-run)
```ts
type GameState = {
  timeLeft: number;    // seconds remaining
  stress: number;      // 0–100
  privilege: number;   // 0–N
  bureaucracy: number; // 0–100
  security: number;    // 0–100
  influence: number;   // modifier
  score: number;
}
```

**events table** (PostgreSQL)
```sql
CREATE TABLE events (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  base_weight INTEGER NOT NULL DEFAULT 10,
  cooldown    INTEGER NOT NULL DEFAULT 0,  -- seconds
  conditions  JSONB NOT NULL DEFAULT '[]', -- [{param, op, value}]
  actions     JSONB NOT NULL DEFAULT '[]', -- [{id, label, effects, cooldown, scoreImpact}]
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

**Condition JSON schema**
```json
{ "param": "stress", "op": ">", "value": 60 }
```

**Action JSON schema**
```json
{
  "id": "bribe",
  "label": "Pay the official",
  "effects": [{"target": "privilege", "delta": 1}, {"target": "stress", "delta": 10}],
  "cooldown": 3,
  "scoreImpact": -5
}
```

**runs table** (PostgreSQL)
```sql
CREATE TABLE runs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES users(id),
  score      INTEGER NOT NULL,
  outcome    TEXT NOT NULL,  -- 'win' | 'lose_time' | 'lose_stress' | 'lose_privilege'
  duration   INTEGER,        -- seconds
  started_at TIMESTAMPTZ,
  ended_at   TIMESTAMPTZ
);
```

---

### 6. Data Flow

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
  → filters eligible events
  → weighted random pick
     │
     ▼
[React re-renders EventCard]
     │
     └─→ [on run end] POST /api/scores  →  DB
```

---

### 7. Scalability & Reliability

**Bottlenecks in current design doc:**
1. Event selection is O(n) scan over all events — fine for <1000 events; at scale, index conditions
2. Weighted random must handle ties and zero-weight events gracefully
3. Client-side timer drift — use `performance.now()` not `Date.now()` for accurate countdowns

**Growth strategy:**
- SPA is static; scales infinitely via CDN
- API is stateless (JWT); horizontal scaling is trivial — add instances behind load balancer
- DB: PostgreSQL handles thousands of concurrent score writes easily; add read replica for leaderboard queries
- Event config is read-heavy, write-rare — cache in Redis (or Cloudflare KV at edge) with TTL invalidation on admin save

**Reliability:**
- Game engine is pure functions → fully unit testable, no mocking
- Run state is ephemeral client-side → no distributed state problem
- Admin mutations are the only write-critical path → wrap in DB transactions

---

### 8. Constraints & Assumptions

- No real-time multiplayer in this phase
- Auth is optional for gameplay (guest runs allowed); required only for leaderboard submission
- Event config changes are low-frequency (admin use), so eventual consistency (cache TTL ~60s) is acceptable
- Score is self-reported from client — anti-cheat is out of scope for Phase 1
- Single language/locale (English) assumed; i18n not planned

---

## Execution Plan

1. Write `docs/plan/hld.md` with the full document above
2. No code changes — this is a design document only
