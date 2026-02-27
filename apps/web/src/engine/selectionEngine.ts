import type { GameState, Condition, Event } from 'shared'

export function evaluateCondition(state: GameState, condition: Condition): boolean {
  const val = state[condition.param] as number
  switch (condition.op) {
    case '>':  return val >  condition.value
    case '<':  return val <  condition.value
    case '>=': return val >= condition.value
    case '<=': return val <= condition.value
    case '==': return val === condition.value
    case '!=': return val !== condition.value
  }
}

export function evaluateConditions(state: GameState, conditions: Condition[]): boolean {
  return conditions.every(c => evaluateCondition(state, c))
}

export function computeWeight(
  event: Event,
  _state: GameState,
  envModifiers: Record<string, number>,
): number {
  const stateModifier = 1.0 // Phase 1: hook for future state-based tuning
  const envModifier = envModifiers[event.id] ?? 1.0
  return event.baseWeight * stateModifier * envModifier
}

export function generateEnvModifiers(events: Event[]): Record<string, number> {
  const modifiers: Record<string, number> = {}
  for (const event of events) {
    modifiers[event.id] = 0.8 + Math.random() * 0.4 // [0.8, 1.2]
  }
  return modifiers
}

export function weightedRandomPick<T>(items: T[], weights: number[]): T | null {
  if (items.length === 0) return null

  const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0)
  if (total <= 0) return null

  let roll = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    const w = Math.max(0, weights[i])
    roll -= w
    if (roll <= 0) return items[i]
  }

  // Fallback: return last item with positive weight
  for (let i = items.length - 1; i >= 0; i--) {
    if (weights[i] > 0) return items[i]
  }
  return null
}
