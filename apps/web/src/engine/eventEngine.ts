import type { Event, GameState, CooldownState, RunOutcome, Action } from 'shared'
import { applyAndClamp, checkLoseCondition } from './stateManager'
import { startEventCooldown, startActionCooldown, isEventOnCooldown } from './cooldownManager'
import { evaluateConditions, computeWeight, weightedRandomPick } from './selectionEngine'

export function getEligibleEvents(
  events: Event[],
  state: GameState,
  cooldowns: CooldownState,
  now: number,
): Event[] {
  return events.filter(
    e => evaluateConditions(state, e.conditions) && !isEventOnCooldown(cooldowns, e.id, now),
  )
}

export function selectNextEvent(
  events: Event[],
  state: GameState,
  cooldowns: CooldownState,
  envModifiers: Record<string, number>,
  now: number,
): Event | null {
  const eligible = getEligibleEvents(events, state, cooldowns, now)
  if (eligible.length === 0) return null
  const weights = eligible.map(e => computeWeight(e, state, envModifiers))
  return weightedRandomPick(eligible, weights)
}

export function applyAction(
  gameState: GameState,
  cooldowns: CooldownState,
  action: Action,
  eventId: string,
  eventCooldown: number,
  now: number,
): { gameState: GameState; cooldowns: CooldownState } {
  const effects = [
    ...action.effects,
    ...(action.scoreImpact !== 0
      ? [{ target: 'score' as const, delta: action.scoreImpact }]
      : []),
  ]
  const nextGameState = applyAndClamp(gameState, effects)
  let nextCooldowns = startActionCooldown(cooldowns, action.id, action.cooldown, now)
  nextCooldowns = startEventCooldown(nextCooldowns, eventId, eventCooldown, now)
  return { gameState: nextGameState, cooldowns: nextCooldowns }
}

export function checkRunOutcome(
  state: GameState,
  selectedEvent?: Event,
): RunOutcome | null {
  const loseReason = checkLoseCondition(state)
  if (loseReason !== null) return loseReason

  if (selectedEvent?.terminal) {
    if (selectedEvent.terminalOutcome === 'win') return 'win'
    if (selectedEvent.terminalOutcome === 'lose') return 'critical'
  }

  return null
}
