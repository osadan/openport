import type { GameState, Effect, LoseReason } from 'shared'

export const INITIAL_STATE: GameState = {
  timeLeft: 180,
  stress: 20,
  privilege: 1,
  bureaucracy: 20,
  security: 20,
  influence: 0,
  score: 0,
}

export function initState(overrides?: Partial<GameState>): GameState {
  return { ...INITIAL_STATE, ...overrides }
}

export function applyEffects(state: GameState, effects: Effect[]): GameState {
  const next = { ...state }
  for (const effect of effects) {
    next[effect.target] = (next[effect.target] as number) + effect.delta
  }
  return next
}

export function clampState(state: GameState): GameState {
  return {
    ...state,
    stress: Math.min(100, Math.max(0, state.stress)),
    bureaucracy: Math.min(100, Math.max(0, state.bureaucracy)),
    security: Math.min(100, Math.max(0, state.security)),
    privilege: Math.max(0, state.privilege),
    timeLeft: Math.max(0, state.timeLeft),
  }
}

export function applyAndClamp(state: GameState, effects: Effect[]): GameState {
  return clampState(applyEffects(state, effects))
}

export function checkLoseCondition(state: GameState): LoseReason | null {
  if (state.timeLeft <= 0) return 'time'
  if (state.stress >= 100) return 'stress'
  if (state.privilege <= 0) return 'privilege'
  return null
}
