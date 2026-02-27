import { create } from 'zustand'
import type { GameState, CooldownState, Event, Action, RunOutcome } from 'shared'
import eventsRaw from './data/events.json'
import configRaw from './data/config.json'
import { initState } from './engine/stateManager'
import { emptyCooldowns } from './engine/cooldownManager'
import { generateEnvModifiers } from './engine/selectionEngine'
import {
  selectNextEvent,
  applyAction as engineApplyAction,
  checkRunOutcome,
} from './engine/eventEngine'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const config = configRaw as any

export type Phase = 'idle' | 'playing' | 'over'

type Store = {
  phase: Phase
  allEvents: Event[]
  gameState: GameState
  cooldowns: CooldownState
  envModifiers: Record<string, number>
  currentEvent: Event | null
  outcome: RunOutcome | null
  log: string[]

  startRun(): Promise<void>
  pickAction(action: Action, event: Event): void
  tick(): void
}

export const useGameStore = create<Store>((set, get) => ({
  phase: 'idle',
  allEvents: eventsRaw as unknown as Event[],
  gameState: initState(),
  cooldowns: emptyCooldowns(),
  envModifiers: {},
  currentEvent: null,
  outcome: null,
  log: [],

  async startRun() {
    let allEvents: Event[]
    try {
      const res = await fetch('/api/events')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      allEvents = await res.json()
    } catch {
      allEvents = eventsRaw as unknown as Event[]
    }

    const gameState = initState({
      stress:      randomInRange(config.initRanges.stress),
      bureaucracy: randomInRange(config.initRanges.bureaucracy),
      security:    randomInRange(config.initRanges.security),
    })
    const cooldowns = emptyCooldowns()
    const envModifiers = generateEnvModifiers(allEvents)
    const now = Date.now()
    const currentEvent = selectNextEvent(allEvents, gameState, cooldowns, envModifiers, now)
    set({
      phase: 'playing',
      allEvents,
      gameState,
      cooldowns,
      envModifiers,
      currentEvent,
      outcome: null,
      log: currentEvent ? [currentEvent.title] : [],
    })
  },

  pickAction(action, event) {
    const { allEvents, gameState, cooldowns, envModifiers } = get()
    const now = Date.now()

    const { gameState: next, cooldowns: nextCooldowns } = engineApplyAction(
      gameState, cooldowns, action, event.id, event.cooldown, now,
    )

    const outcome = checkRunOutcome(next, event)
    if (outcome !== null) {
      set({ gameState: next, cooldowns: nextCooldowns, outcome, phase: 'over' })
      return
    }

    const nextEvent = selectNextEvent(allEvents, next, nextCooldowns, envModifiers, now)

    set(state => ({
      gameState: next,
      cooldowns: nextCooldowns,
      currentEvent: nextEvent,
      log: [
        `> ${action.label}`,
        ...(nextEvent ? [nextEvent.title] : []),
        ...state.log,
      ].slice(0, 12),
    }))
  },

  tick() {
    const { phase, allEvents, gameState, cooldowns, envModifiers, currentEvent } = get()
    if (phase !== 'playing') return

    const next = { ...gameState, timeLeft: Math.max(0, gameState.timeLeft - 1) }
    const outcome = checkRunOutcome(next)
    if (outcome !== null) {
      set({ gameState: next, outcome, phase: 'over' })
      return
    }

    // If no event is showing (all were on cooldown), retry selection every tick
    // so the game unblocks automatically as soon as any cooldown expires.
    if (!currentEvent) {
      const nextEvent = selectNextEvent(allEvents, next, cooldowns, envModifiers, Date.now())
      set({ gameState: next, currentEvent: nextEvent })
    } else {
      set({ gameState: next })
    }
  },
}))

function randomInRange([min, max]: [number, number]): number {
  return Math.floor(min + Math.random() * (max - min + 1))
}
