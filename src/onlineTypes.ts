import type { ActionCard, Board, FigureCard, GameResult, Move, PlayerColor, Square, TurnPhase } from './domain'

export interface PublicEvent {
  id: number
  text: string
}

export interface PendingTradeView {
  actionId: string
  offered: FigureCard
}

export interface PublicGameView {
  roomId: string
  player?: PlayerColor
  status: 'waiting' | 'playing' | 'finished'
  board: Board
  current: PlayerColor
  phase: TurnPhase
  turn: number
  result?: GameResult
  message?: string
  selectedCardId?: string
  activeEffectType?: string
  me?: {
    color: PlayerColor
    figures: FigureCard[]
    actions: ActionCard[]
  }
  opponent: {
    connected: boolean
    figureCount: number
    actionCount: number
  }
  decks: {
    figures: { draw: number; discard: number }
    actions: { draw: number; discard: number }
  }
  playableFigureIds: string[]
  playableActionIds: string[]
  canEndWithoutMove: boolean
  pendingTrade?: PendingTradeView
  events: PublicEvent[]
}

export type OnlineClientMessage =
  | { type: 'draw' }
  | { type: 'select'; id: string }
  | { type: 'move'; move: Move }
  | { type: 'action'; id: string; target?: string }
  | { type: 'end' }
  | { type: 'prepareTrade'; id: string }
  | { type: 'cancelPending' }

export type OnlineServerMessage =
  | { type: 'welcome'; roomId: string; player?: PlayerColor; token?: string; shareUrl: string }
  | { type: 'view'; view: PublicGameView }
  | { type: 'error'; message: string }

export interface CreateGameResponse {
  roomId: string
  player: PlayerColor
  token: string
  playUrl: string
  shareUrl: string
}

export const isSquare = (value: string): value is Square => /^[a-h][1-8]$/.test(value)
