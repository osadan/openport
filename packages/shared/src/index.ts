export type GameState = {
  timeLeft: number
  stress: number
  privilege: number
  bureaucracy: number
  security: number
  influence: number
  score: number
}

export type Effect = {
  target: keyof GameState
  delta: number
}

export type Condition = {
  param: keyof GameState
  op: '>' | '<' | '>=' | '<=' | '==' | '!='
  value: number
}

export type Action = {
  id: string
  label: string
  effects: Effect[]
  cooldown: number
  scoreImpact: number
}

export type Event = {
  id: string
  title: string
  description: string
  baseWeight: number
  cooldown: number
  conditions: Condition[]
  actions: Action[]
}
