import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core'
import { Chessboard } from 'react-chessboard'
import { useEffect, useMemo, useReducer, useState } from 'react'
import type { ActionCard, FigureCard, GameState, Move, Square } from './domain'
import { RandomAgent, actionText, beginTurn, endTurn, newGame, playableAction, playableFigures, playMove, seeded, selectFigureCard, useAction } from './engine'
import './app.css'

const random = seeded(Date.now())
type Act = { type: 'start' } | { type: 'begin' } | { type: 'select'; id: string } | { type: 'move'; move: Move } | { type: 'action'; id: string; target?: string } | { type: 'end' }
function reducer(state: GameState | undefined, action: Act): GameState | undefined {
  if (action.type === 'start') return newGame(random)
  if (!state) return state
  if (action.type === 'begin') return beginTurn(state, random)
  if (action.type === 'select') return selectFigureCard(state, action.id)
  if (action.type === 'move') return playMove(state, action.move, random)
  if (action.type === 'action') return useAction(state, action.id, random, action.target)
  return endTurn(state)
}
const glyph: Record<string, string> = { pawn: 'P', knight: 'N', bishop: 'B', rook: 'R', queen: 'Q', king: 'K', joker: 'J' }
const cardLabel = (card: FigureCard | ActionCard) => card.kind === 'figure' ? `${card.type[0].toUpperCase()}${card.type.slice(1)}` : actionText[card.type][0]
function Card({ card, active, playable, onClick }: { card: FigureCard | ActionCard; active?: boolean; playable?: boolean; onClick?: () => void }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: card.id })
  return <button ref={setNodeRef} {...attributes} {...listeners} onClick={onClick} className={`card ${card.kind} ${active ? 'active' : ''} ${playable ? 'playable' : ''}`} style={{ transform: transform ? `translate(${transform.x}px,${transform.y}px)` : undefined }} title={card.kind === 'action' ? actionText[card.type][1] : cardLabel(card)}>{card.kind === 'figure' ? glyph[card.type] : actionText[card.type][0]}</button>
}
function DropZone() { const { setNodeRef, isOver } = useDroppable({ id: 'discard' }); return <div ref={setNodeRef} className={`drop ${isOver ? 'over' : ''}`}>Play card here</div> }
function toFen(board: GameState['board']) { const code: Record<string, string> = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' }; return [8,7,6,5,4,3,2,1].map(rank => { let out = '', empty = 0; for (const file of 'abcdefgh') { const piece = board[`${file}${rank}` as Square]; if (!piece) empty++; else { if (empty) { out += empty; empty = 0 }; out += piece.color === 'white' ? code[piece.type].toUpperCase() : code[piece.type] } } return out + (empty || '') }).join('/') }
function Help({ close }: { close: () => void }) { return <div className="help"><div><button onClick={close}>Close</button><h2>Quick rules</h2><p>There is no check or checkmate. Kings may enter attacked squares and are captured like any other piece. Capture the opposing king to win.</p><p>Draw one figure card at the beginning of your turn, use action cards, then play a matching figure card to move. A joker represents any figure type.</p><p>When you lose a piece you draw action cards: pawn 1, knight or bishop 2, rook 3, queen 5.</p></div></div> }
function App() {
  const [state, dispatch] = useReducer(reducer, undefined)
  const [help, setHelp] = useState(false)
  const [selected, setSelected] = useState<Square>()
  const [drawn, setDrawn] = useState<FigureCard>()
  const [drawing, setDrawing] = useState(false)
  const agent = useMemo(() => new RandomAgent(), [])
  useEffect(() => { if (!state || state.result || state.current !== 'black' || state.phase !== 'start') return; const timer = setTimeout(async () => { const prepared = beginTurn(state, random); const decision = await agent.chooseTurn(prepared, random); if ('end' in decision) dispatch({ type: 'end' }); else { dispatch({ type: 'begin' }); setTimeout(() => { dispatch({ type: 'select', id: decision.cardId }); dispatch({ type: 'move', move: decision.move }) }, 250) } }, 650); return () => clearTimeout(timer) }, [state, agent])
  if (!state) return <main className="start"><h1>Card Chess</h1><p>Capture the opposing king. Move pieces only with matching cards.</p><button onClick={() => dispatch({ type: 'start' })}>Start game</button><button className="quiet" onClick={() => setHelp(true)}>Rules</button>{help && <Help close={() => setHelp(false)} />}</main>
  const me = state.players.white
  const active = state.current === 'white'
  const selectedCard = me.figures.find(card => card.id === state.selectedCardId)
  const drawCard = () => { if (!active || state.phase !== 'start' || drawing) return; setDrawing(true); const nextCard = state.figures.draw[state.figures.draw.length - 1]; setDrawn(nextCard); window.setTimeout(() => { dispatch({ type: 'begin' }); setDrawing(false) }, 420) }
  const onDrop = (from: string, to: string) => { if (active) dispatch({ type: 'move', move: { from: from as Square, to: to as Square } }); return false }
  const act = (card: ActionCard) => { const selector = card.type === 'reinforce' ? 'input[data-reinforce]' : 'input[data-block]'; const target = card.type === 'reinforce' || card.type === 'block' ? window.document.querySelector<HTMLInputElement>(selector)?.value : undefined; dispatch({ type: 'action', id: card.id, target }) }
  return <DndContext onDragEnd={({ active: drag, over }) => { if (over?.id === 'discard') { const card = [...me.figures, ...me.actions].find(item => item.id === drag.id); if (card?.kind === 'figure') dispatch({ type: 'select', id: card.id }); else if (card) act(card) } }}><main><header><strong>Card Chess</strong><span>{active ? 'Your turn' : 'Computer turn'} · {state.phase}</span><button className="quiet" onClick={() => setHelp(true)}>Rules</button></header><section className="enemy">Opponent hand: {state.players.black.figures.length + state.players.black.actions.length} face-down cards</section><div className="table"><aside><b>Figure deck</b><button className={`deck ${drawing ? 'drawing' : ''}`} onClick={drawCard} disabled={!active || state.phase !== 'start'}>{state.phase === 'start' && active ? 'Draw card' : state.figures.draw.length}</button><small>Discard: {state.figures.discard.length}</small></aside><div className="board"><Chessboard id="game" position={toFen(state.board)} onPieceDrop={onDrop} onSquareClick={square => { if (!active || !selectedCard) return; if (selected) { dispatch({ type: 'move', move: { from: selected, to: square as Square } }); setSelected(undefined) } else if (state.board[square as Square]?.color === 'white') setSelected(square as Square) }} boardOrientation="white" arePiecesDraggable={active && !!selectedCard} /><DropZone /></div><aside><b>Action deck</b><div className="deck actiondeck">{state.actions.draw.length}</div><small>Discard: {state.actions.discard.length}</small></aside></div>{drawn && <section className="drawn-card" aria-live="polite"><span>You drew</span><Card card={drawn} playable /><button className="quiet" onClick={() => setDrawn(undefined)}>Continue</button></section>}<section className="hand"><h2>Your figure cards</h2><div>{me.figures.map(card => <Card key={card.id} card={card} active={card.id === state.selectedCardId} playable={playableFigures(state, 'white').some(item => item.id === card.id)} onClick={() => active && dispatch({ type: 'select', id: card.id })} />)}</div><h2>Your action cards</h2><div>{me.actions.map(card => <Card key={card.id} card={card} playable={playableAction(state, card)} onClick={() => active && act(card)} />)}</div><div className="targets"><label>Reinforce square <input data-reinforce placeholder="e2" /></label><label>Block square <input data-block placeholder="e7" /></label></div></section>{state.message && <p className="message">{state.message}</p>}{active && state.phase === 'actions' && <button className="end" onClick={() => dispatch({ type: 'end' })}>End turn</button>}{state.result && <div className="overlay"><div><h2>{state.result.winner === 'white' ? 'You win' : 'Computer wins'}</h2><p>The king was captured.</p><button onClick={() => dispatch({ type: 'start' })}>New game</button></div></div>}{help && <Help close={() => setHelp(false)} />}</main></DndContext>
}
export default App
