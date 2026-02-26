להלן מסמך Pantheon Design מלא באנגלית, ברמת High-Level, כולל ה-core flow וה-Admin Management screen.

---

# OPEN THE PORT

## Pantheon Game Design Document

---

# 1. Vision

**Open The Port** is a web-based, event-driven decision game built around systemic state evolution rather than fixed story branches.

There are:

* No “correct” answers
* No deterministic paths
* No fixed stage progression

Each action mutates the system state.
The next event is selected probabilistically from events that satisfy the current state conditions.

The experience should feel:

* Dynamic
* Systemic
* Pressure-driven
* Replayable
* Slightly chaotic but internally consistent

---

# 2. Core Design Philosophy

1. State-driven progression (not scripted progression)
2. Trade-offs, not right/wrong decisions
3. Emergent flow from numeric systems
4. Time pressure as primary tension driver
5. Fully data-driven event architecture
6. Expandable via Admin panel without code changes

---

# 3. Core Game Model

---

## 3.1 Primary Resources (Global State)

```ts
type GameState = {
  timeLeft: number          // countdown timer
  stress: number            // 0–100
  privilege: number         // 0–N
  bureaucracy: number       // 0–100
  security: number          // 0–100
  influence: number         // soft power modifier
  score: number             // final run evaluation
}
```

There is no fixed “phase”.
System behavior emerges from parameter ranges.

---

## 3.2 Victory & Failure Conditions

### Win Condition

A terminal “Approval” event becomes eligible when:

* privilege ≥ threshold
* security within acceptable range
* bureaucracy not excessively high
* timeLeft > 0

Player selects an action from that event → run ends successfully.

---

### Lose Conditions

* timeLeft ≤ 0
* stress ≥ 100
* privilege ≤ 0
* Critical terminal event triggered

---

# 4. Core Gameplay Flow

---

## 4.1 Run Initialization

At start of each run:

* timeLeft initialized (e.g., 180 seconds)
* stress = baseline
* privilege = 1
* other parameters seeded randomly within ranges
* hidden environment modifiers generated

---

## 4.2 Core Loop

The game cycles through the following loop:

1. Event is displayed
2. Player selects an Action
3. Action effects mutate GameState
4. Cooldown period activates
5. Event Selection Engine runs
6. Next eligible Event is selected via weighted random
7. Repeat

Time continuously decreases during the run and during cooldowns.

---

# 5. Event System Architecture

---

## 5.1 Event Structure

```ts
type Event = {
  id: string
  title: string
  description: string
  baseWeight: number
  cooldown: number               // internal event cooldown
  conditions: Condition[]
  actions: Action[]
}
```

---

## 5.2 Conditions

Conditions determine event eligibility.

```ts
type Condition = (state: GameState) => boolean
```

Examples:

* state.stress > 60
* state.privilege >= 2
* state.timeLeft < 45
* state.security > 70

An event is eligible only if all conditions are satisfied.

---

## 5.3 Action Structure

```ts
type Action = {
  id: string
  label: string
  effects: Effect[]
  cooldown: number
  scoreImpact: number
}
```

---

## 5.4 Effects Model

Effects mutate the GameState.

```ts
type Effect = {
  target: keyof GameState
  delta: number
}
```

Example:

* stress +15
* privilege +1
* timeLeft -10
* bureaucracy +5

Actions do not determine the next event.
They only change state.

---

# 6. Event Selection Engine

---

## 6.1 Selection Algorithm

After each Action:

1. Filter eligible events:

```text
eligibleEvents = events.filter(e => conditions satisfied)
```

2. Remove events currently in cooldown

3. Compute effective weight:

```text
effectiveWeight = baseWeight * stateModifier * environmentModifier
```

4. Perform weighted random selection

5. Apply event cooldown

---

## 6.2 Event Cooldown System

Each event has:

* baseCooldown (in seconds or cycles)
* cannot reappear until cooldown expires

Prevents repetition loops.

---

# 7. Time & Cooldown System

---

## 7.1 Global Countdown

* timeLeft continuously decreases
* every action reduces time directly
* cooldown periods consume time

---

## 7.2 Action Cooldown

After selecting an action:

* buttons disabled
* short delay (e.g., 2–5 seconds)
* visual progress indicator
* state still ticking

---

## 7.3 Event Cooldown

Event-level cooldown prevents immediate recurrence.

---

# 8. Scoring Model

Score accumulates during run.

Sources:

* Action scoreImpact
* Surviving high stress
* Fast resolution
* High privilege end state

Score affects post-run rating only.

Example tiers:

| Score Range | Outcome                 |
| ----------- | ----------------------- |
| < 50        | Temporary Approval      |
| 50–150      | Standard Approval       |
| 150+        | Permanent Authorization |

---

# 9. Emergent Flow Model

The game naturally forms 3 phases:

### Early Game

Low privilege, balanced parameters
General events

### Mid Game

One or more parameters drift
Pressure events emerge

### Late Game

Extreme parameter values
High-risk/high-impact events
Terminal events become eligible

This is not scripted — it emerges from state.

---

# 10. Admin Management Screen

Purpose:
Enable full runtime management of Events and Actions without code modification.

Accessible at:

```
/admin
```

---

## 10.1 Admin Capabilities

* View all events
* Create new event
* Edit event
* Delete event
* Add/remove conditions
* Add/remove actions
* Define score impact per action
* Define cooldown per event
* Export JSON configuration
* Import JSON configuration

---

## 10.2 Admin Event Model

Editable fields:

* Event ID
* Title
* Description
* Base Weight
* Event Cooldown
* Conditions list
* Actions list

---

## 10.3 Admin Action Model

Editable fields:

* Action Label
* Effects (target + delta)
* Action Cooldown
* Score Impact

---

## 10.4 Event Condition Builder

Admin UI allows:

* Select parameter
* Select operator (>, <, >=, <=, ==)
* Input value

Example:

```
stress > 60
privilege >= 2
timeLeft < 30
```

Multiple conditions combine with AND logic.

---

## 10.5 Simulation Tool (Optional)

Admin panel may include:

* Simulate 100 runs
* Show event frequency
* Show average score
* Detect runaway parameter growth

Used for balancing.

---

# 11. UI Structure (High-Level)

---

## Game Screen Layout

### Top Bar

* Countdown Timer (primary visual anchor)
* Stress Bar
* Privilege Indicator
* Score

---

### Center Panel

* Event Card

  * Title
  * Description
  * 2–4 Action Buttons

During cooldown:

* Buttons disabled
* Progress indicator visible

---

### Bottom / Side

* Recent event log (last 5 state changes)

---

## Admin Screen Layout

### Left Panel

* Event list
* Add Event button

### Right Panel

* Event editor form
* Dynamic Actions section
* Dynamic Conditions section
* Save / Delete buttons
* Import / Export controls

---

# 12. Architectural Overview (HLD)

---

## 12.1 Application Type

Client-side SPA
No backend required (Phase 1)

---

## 12.2 Core Modules

```
/engine
  stateManager
  eventEngine
  cooldownManager
  selectionEngine
/data
  events.json
  config.json
/ui
  GameView
  EventCard
  AdminView
```

---

## 12.3 Data Flow

User Action
→ State Mutation
→ Cooldown Trigger
→ Event Selection
→ Render

---

## 12.4 Persistence Strategy

Phase 1:

* LocalStorage

Phase 2:

* JSON Import/Export

---

# 13. Replayability Drivers

* Randomized initial parameters
* State-driven eligibility
* Weighted event randomness
* Cooldown variance
* Score-based outcome tiers

---

# 14. Expansion Path

Future additions may include:

* Meta progression
* Difficulty modes
* Multiple environments
* Global modifiers
* Competitive leaderboard
* Narrative packs (event bundles)

---

If needed, the next logical step would be:

* Detailed Low-Level Design (LLD)
* JSON schema definition
* Event balancing framework
* Deterministic seeded RNG model

