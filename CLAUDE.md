# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Open The Port** is a web-based, client-side SPA decision game. There is no backend (Phase 1). The full game design is in `docs/plan/first_design.md`.

## Architecture

### Core Modules (per design)

```
/engine
  stateManager      — holds and mutates GameState
  eventEngine       — filters eligible events, applies cooldowns
  selectionEngine   — weighted random event selection
  cooldownManager   — tracks per-event and per-action cooldowns
/data
  events.json       — fully data-driven event definitions
  config.json       — initial state seeds, thresholds, score tiers
/ui
  GameView          — top bar (timer, stress, privilege, score), event card, action buttons, event log
  EventCard         — title, description, 2–4 action buttons, cooldown progress
  AdminView         — at /admin; left panel event list, right panel event editor
```

### Data Flow

User selects Action → state mutation via effects → action cooldown activates → event selection engine runs (filter eligible, remove cooled-down, weighted random pick) → render next event.

### Key Types

```ts
type GameState = {
  timeLeft: number; stress: number; privilege: number;
  bureaucracy: number; security: number; influence: number; score: number;
}

type Event = {
  id: string; title: string; description: string;
  baseWeight: number; cooldown: number;
  conditions: Condition[]; actions: Action[];
}

type Action = { id: string; label: string; effects: Effect[]; cooldown: number; scoreImpact: number; }
type Effect = { target: keyof GameState; delta: number; }
type Condition = (state: GameState) => boolean;
```

### Win/Lose Logic

- **Win**: terminal "Approval" event becomes eligible when `privilege ≥ threshold`, `security` in range, `bureaucracy` not too high, `timeLeft > 0`
- **Lose**: `timeLeft ≤ 0`, `stress ≥ 100`, `privilege ≤ 0`, or a critical terminal event fires

### Event Selection Algorithm

1. Filter events whose conditions all pass against current state
2. Remove events currently in cooldown
3. Compute `effectiveWeight = baseWeight * stateModifier * environmentModifier`
4. Weighted random pick; apply that event's cooldown

### Persistence

Phase 1: LocalStorage. Phase 2: JSON import/export via Admin panel.

### Admin Panel (`/admin`)

Full CRUD on events and actions, condition builder (parameter + operator + value, AND-combined), JSON import/export. Goal: game content changes require no code modifications.
