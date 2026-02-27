import type { CooldownState } from 'shared'

export function emptyCooldowns(): CooldownState {
  return { events: {}, actions: {} }
}

export function startEventCooldown(
  state: CooldownState,
  eventId: string,
  durationSec: number,
  now: number,
): CooldownState {
  return {
    ...state,
    events: { ...state.events, [eventId]: now + durationSec * 1000 },
  }
}

export function startActionCooldown(
  state: CooldownState,
  actionId: string,
  durationSec: number,
  now: number,
): CooldownState {
  return {
    ...state,
    actions: { ...state.actions, [actionId]: now + durationSec * 1000 },
  }
}

export function isEventOnCooldown(state: CooldownState, eventId: string, now: number): boolean {
  const expiry = state.events[eventId]
  return expiry !== undefined && now < expiry
}

export function isActionOnCooldown(state: CooldownState, actionId: string, now: number): boolean {
  const expiry = state.actions[actionId]
  return expiry !== undefined && now < expiry
}

export function getEventCooldownRemaining(
  state: CooldownState,
  eventId: string,
  now: number,
): number {
  const expiry = state.events[eventId]
  if (expiry === undefined || now >= expiry) return 0
  return (expiry - now) / 1000
}

export function getActionCooldownRemaining(
  state: CooldownState,
  actionId: string,
  now: number,
): number {
  const expiry = state.actions[actionId]
  if (expiry === undefined || now >= expiry) return 0
  return (expiry - now) / 1000
}
