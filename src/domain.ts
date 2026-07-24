export type PlayerColor = 'white' | 'black'
export type PieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king'
export type Square = `${'a'|'b'|'c'|'d'|'e'|'f'|'g'|'h'}${1|2|3|4|5|6|7|8}`
export interface Piece { id: string; type: PieceType; color: PlayerColor; moved: boolean }
export type Board = Partial<Record<Square, Piece>>
export type FigureCardType = PieceType | 'joker'
export interface FigureCard { id: string; kind: 'figure'; type: FigureCardType }
export type ActionCardType = 'supply' | 'exchange' | 'spy' | 'trade' | 'lock' | 'double' | 'reinforce' | 'block'
export interface ActionCard { id: string; kind: 'action'; type: ActionCardType }
export type Card = FigureCard | ActionCard
export interface Deck<T> { draw: T[]; discard: T[] }
export type DiscardPile<T> = T[]
export interface PlayerState { color: PlayerColor; figures: FigureCard[]; actions: ActionCard[]; actionLocked: boolean; blockedPieceId?: string }
export type TurnPhase = 'start' | 'actions' | 'move' | 'gameOver'
export interface Move { from: Square; to: Square; promotion?: Exclude<PieceType, 'pawn'|'king'> }
export interface CaptureResult { board: Board; captured?: Piece; winner?: PlayerColor }
export interface ActiveActionEffect { type: ActionCardType; firstPieceId?: string }
export interface GameResult { winner: PlayerColor }
export interface GameState { board: Board; players: Record<PlayerColor, PlayerState>; figures: Deck<FigureCard>; actions: Deck<ActionCard>; current: PlayerColor; phase: TurnPhase; selectedCardId?: string; selectedSquare?: Square; activeEffect?: ActiveActionEffect; result?: GameResult; message?: string; turn: number }
export interface RandomSource { next(): number }
export const other = (c: PlayerColor): PlayerColor => c === 'white' ? 'black' : 'white'
