import { Chessboard } from 'react-chessboard'
import { useEffect, useMemo, useReducer, useState } from 'react'
import actionBack from './assets/ui/cards/backs/action.svg'
import figureBack from './assets/ui/cards/backs/figure.svg'
import bishopCard from './assets/ui/cards/pieces/bishop.svg'
import kingCard from './assets/ui/cards/pieces/king.svg'
import knightCard from './assets/ui/cards/pieces/knight.svg'
import pawnCard from './assets/ui/cards/pieces/pawn.svg'
import queenCard from './assets/ui/cards/pieces/queen.svg'
import rookCard from './assets/ui/cards/pieces/rook.svg'
import jokerCard from './assets/ui/cards/special/joker.svg'
import type { ActionCard, FigureCard, FigureCardType, GameState, Move, Square } from './domain'
import {
  RandomAgent,
  actionText,
  beginTurn,
  newGame,
  playableAction,
  playableFigures,
  playMove,
  seeded,
  selectFigureCard,
  skipFigureMove,
  useAction,
} from './engine'
import OnlineGame from './OnlineGame'
import type { CreateGameResponse } from './onlineTypes'
import './app.css'

const random = seeded(Date.now())

type Act =
  | { type: 'start' }
  | { type: 'begin' }
  | { type: 'select'; id: string }
  | { type: 'move'; move: Move }
  | { type: 'action'; id: string; target?: string }
  | { type: 'end' }

type PendingAction =
  | { type: 'exchange'; card: ActionCard; selectedIds: string[] }
  | { type: 'trade'; card: ActionCard; offered: FigureCard; selectedId?: string }

const figureArt: Record<FigureCardType, string> = {
  pawn: pawnCard,
  knight: knightCard,
  bishop: bishopCard,
  rook: rookCard,
  queen: queenCard,
  king: kingCard,
  joker: jokerCard,
}

const figureSortOrder: Record<FigureCardType, number> = {
  pawn: 0,
  knight: 1,
  bishop: 2,
  rook: 3,
  queen: 4,
  king: 5,
  joker: 6,
}

function reducer(state: GameState | undefined, action: Act): GameState | undefined {
  if (action.type === 'start') return newGame(random)
  if (!state) return state
  if (action.type === 'begin') return beginTurn(state, random)
  if (action.type === 'select') return selectFigureCard(state, action.id)
  if (action.type === 'move') return playMove(state, action.move, random)
  if (action.type === 'action') return useAction(state, action.id, random, action.target)
  return skipFigureMove(state, random)
}

const cardLabel = (card: FigureCard | ActionCard) =>
  card.kind === 'figure' ? `${card.type[0].toUpperCase()}${card.type.slice(1)}` : actionText[card.type][0]

const sortedFigures = (cards: FigureCard[]) =>
  [...cards].sort((a, b) => figureSortOrder[a.type] - figureSortOrder[b.type] || cardLabel(a).localeCompare(cardLabel(b)))

const sortedActions = (cards: ActionCard[]) => [...cards].sort((a, b) => cardLabel(a).localeCompare(cardLabel(b)))

function uiMessage(message: string) {
  if (message.includes('Opponent figure cards:')) return message
  if (message.includes('cannot be played')) return message
  if (message.includes('Choose an empty square')) return message
  if (message.includes('Choose an opposing piece')) return message
  if (message.includes('erste') || message.includes('first')) return 'The first move of a double move cannot capture.'
  if (message.includes('Doppel' + 'zug') || message.includes('Double')) return 'A double move must use two different pieces.'
  if (message.includes('blockiert') || message.includes('blocked')) return 'This piece is blocked by an action card.'
  if (message.includes('passende Karte')) return 'You did not play a matching figure card for this piece.'
  if (message.includes('bewegen') || message.includes('Feld')) return 'This piece cannot move to that square.'
  return 'Choose a figure card first.'
}

function Card({
  card,
  active,
  playable,
  disabled,
  infoOpen,
  onInfoClick,
  onClick,
}: {
  card: FigureCard | ActionCard
  active?: boolean
  playable?: boolean
  disabled?: boolean
  infoOpen?: boolean
  onInfoClick?: () => void
  onClick?: () => void
}) {
  const label = cardLabel(card)

  return (
    <span className="card-wrap">
      <button
        onClick={onClick}
        className={`card ${card.kind} ${active ? 'active' : ''} ${playable ? 'playable' : ''}`}
        disabled={disabled}
        title={card.kind === 'action' ? actionText[card.type][1] : label}
      >
        {card.kind === 'figure' ? (
          <>
            <img className="card-art" src={figureArt[card.type]} alt="" draggable={false} />
            <span>{label}</span>
          </>
        ) : (
          <span>{label}</span>
        )}
      </button>
      {card.kind === 'action' && onInfoClick && (
        <>
          <button
            className={`card-info ${infoOpen ? 'active' : ''}`}
            type="button"
            aria-label={`Show ${label} help`}
            aria-expanded={infoOpen}
            onClick={(event) => {
              event.stopPropagation()
              onInfoClick()
            }}
          >
            i
          </button>
          {infoOpen && <span className="card-bubble">{actionText[card.type][1]}</span>}
        </>
      )}
    </span>
  )
}

function DeckBack({
  image,
  count,
  label,
  button,
  drawing,
  highlight,
  disabled,
  onClick,
}: {
  image: string
  count: number
  label: string
  button?: boolean
  drawing?: boolean
  highlight?: boolean
  disabled?: boolean
  onClick?: () => void
}) {
  const content = (
    <>
      <img src={image} alt="" draggable={false} />
      <span>{label}</span>
      <strong>{count}</strong>
    </>
  )

  if (button) {
    return (
      <button className={`deck ${drawing ? 'drawing' : ''} ${highlight ? 'highlight' : ''}`} onClick={onClick} disabled={disabled}>
        {content}
      </button>
    )
  }

  return <div className="deck actiondeck">{content}</div>
}

function OpponentHand({ count }: { count: number }) {
  const visible = Math.min(count, 8)

  return (
    <section className="enemy">
      <span>Opponent hand</span>
      <div className="hidden-hand" aria-label={`${count} face-down opponent cards`}>
        {Array.from({ length: visible }, (_, index) => (
          <img
            key={index}
            src={figureBack}
            alt=""
            draggable={false}
            style={{ transform: `translateX(${-index * 12}px) rotate(${index % 2 ? 4 : -4}deg)` }}
          />
        ))}
      </div>
      <strong>{count}</strong>
    </section>
  )
}

function toFen(board: GameState['board']) {
  const code: Record<string, string> = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' }

  return [8, 7, 6, 5, 4, 3, 2, 1]
    .map((rank) => {
      let out = ''
      let empty = 0

      for (const file of 'abcdefgh') {
        const piece = board[`${file}${rank}` as Square]
        if (!piece) {
          empty++
        } else {
          if (empty) {
            out += empty
            empty = 0
          }
          out += piece.color === 'white' ? code[piece.type].toUpperCase() : code[piece.type]
        }
      }

      return out + (empty || '')
    })
    .join('/')
}

function Help({ close }: { close: () => void }) {
  return (
    <div className="help">
      <div>
        <button onClick={close}>Close</button>
        <h2>Quick rules</h2>
        <p>
          There is no check or checkmate. Kings may enter attacked squares and are captured like any other piece.
          Capture the opposing king to win.
        </p>
        <p>
          Draw one figure card at the beginning of your turn, use action cards, then play a matching figure card to
          move. A joker represents any figure type.
        </p>
        <p>When you lose a piece you draw action cards: pawn 1, knight or bishop 2, rook 3, queen 5.</p>
      </div>
    </div>
  )
}

function ActionDialog({
  pending,
  figureCards,
  onToggleExchange,
  onSelectTrade,
  onCancel,
  onConfirm,
}: {
  pending: PendingAction
  figureCards: FigureCard[]
  onToggleExchange: (id: string) => void
  onSelectTrade: (id: string) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const isExchange = pending.type === 'exchange'
  const canConfirm = isExchange ? pending.selectedIds.length > 0 : !!pending.selectedId

  return (
    <div className="modal">
      <section className="action-dialog">
        <div className="dialog-head">
          <h2>{isExchange ? 'Exchange cards' : 'Trade cards'}</h2>
          <button className="quiet" onClick={onCancel}>
            Cancel
          </button>
        </div>

        {isExchange ? (
          <>
            <p>Select one to three figure cards to discard and redraw.</p>
            <div className="dialog-cards">
              {sortedFigures(figureCards).map((card) => (
                <Card
                  key={card.id}
                  card={card}
                  active={pending.selectedIds.includes(card.id)}
                  onClick={() => onToggleExchange(card.id)}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <p>The opponent offers this card. Choose one of yours to give back.</p>
            <div className="trade-offer">
              <div>
                <strong>Offer</strong>
                <Card card={pending.offered} active />
              </div>
              <div>
                <strong>Your card</strong>
                <div className="dialog-cards compact">
                  {sortedFigures(figureCards).map((card) => (
                    <Card
                      key={card.id}
                      card={card}
                      active={pending.selectedId === card.id}
                      onClick={() => onSelectTrade(card.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        <div className="dialog-actions">
          <button onClick={onConfirm} disabled={!canConfirm}>
            Confirm
          </button>
        </div>
      </section>
    </div>
  )
}

function App() {
  const [state, dispatch] = useReducer(reducer, undefined)
  const [help, setHelp] = useState(false)
  const [selected, setSelected] = useState<Square>()
  const [drawing, setDrawing] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction>()
  const [openActionInfoId, setOpenActionInfoId] = useState<string>()
  const [onlineCreating, setOnlineCreating] = useState(false)
  const agent = useMemo(() => new RandomAgent(), [])
  const onlineRoomId = window.location.pathname.match(/^\/online\/([A-Za-z0-9]+)$/)?.[1]

  useEffect(() => {
    if (!openActionInfoId) return

    const closeInfo = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('.card-wrap')) return
      setOpenActionInfoId(undefined)
    }

    window.addEventListener('pointerdown', closeInfo)
    return () => window.removeEventListener('pointerdown', closeInfo)
  }, [openActionInfoId])

  useEffect(() => {
    if (!state || state.result || state.current !== 'black' || state.phase !== 'start') return

    const timer = setTimeout(async () => {
      const prepared = beginTurn(state, random)
      const decision = await agent.chooseTurn(prepared, random)

      if ('end' in decision) {
        dispatch({ type: 'end' })
      } else {
        dispatch({ type: 'begin' })
        setTimeout(() => {
          dispatch({ type: 'select', id: decision.cardId })
          dispatch({ type: 'move', move: decision.move })
        }, 250)
      }
    }, 650)

    return () => clearTimeout(timer)
  }, [state, agent])

  if (onlineRoomId) return <OnlineGame roomId={onlineRoomId} />

  if (!state) {
    const createOnlineGame = async () => {
      setOnlineCreating(true)
      const response = await fetch('/api/games', { method: 'POST' })
      const game = (await response.json()) as CreateGameResponse
      window.location.href = game.playUrl
    }

    return (
      <main className="start">
        <h1>Card Chess</h1>
        <p>Capture the opposing king. Move pieces only with matching cards.</p>
        <button onClick={() => dispatch({ type: 'start' })}>Start game</button>
        <button onClick={createOnlineGame} disabled={onlineCreating}>
          {onlineCreating ? 'Creating online game...' : 'Create online game'}
        </button>
        <button className="quiet" onClick={() => setHelp(true)}>
          Rules
        </button>
        {help && <Help close={() => setHelp(false)} />}
      </main>
    )
  }

  const me = state.players.white
  const active = state.current === 'white'
  const mustDraw = active && state.phase === 'start'
  const canSelectFigureCards = active && !mustDraw
  const canEndWithoutMove = active && (state.phase === 'actions' || state.phase === 'move')
  const selectedCard = me.figures.find((card) => card.id === state.selectedCardId)
  const opponentCardCount = state.players.black.figures.length + state.players.black.actions.length

  const drawCard = () => {
    if (!active || state.phase !== 'start' || drawing) return

    setDrawing(true)
    window.setTimeout(() => {
      dispatch({ type: 'begin' })
      setDrawing(false)
    }, 420)
  }

  const onDrop = (from: string, to: string) => {
    if (active) dispatch({ type: 'move', move: { from: from as Square, to: to as Square } })
    return false
  }

  const act = (card: ActionCard) => {
    setOpenActionInfoId(undefined)
    if (card.type === 'exchange') {
      setPendingAction({ type: 'exchange', card, selectedIds: [] })
      return
    }
    if (card.type === 'trade') {
      const opponentFigures = state.players.black.figures
      const offered = opponentFigures[Math.floor(random.next() * opponentFigures.length)]
      if (offered) setPendingAction({ type: 'trade', card, offered })
      return
    }
    const selector = card.type === 'reinforce' ? 'input[data-reinforce]' : 'input[data-block]'
    const target =
      card.type === 'reinforce' || card.type === 'block'
        ? window.document.querySelector<HTMLInputElement>(selector)?.value
        : undefined
    dispatch({ type: 'action', id: card.id, target })
  }

  const confirmPendingAction = () => {
    if (!pendingAction) return
    if (pendingAction.type === 'exchange') {
      dispatch({ type: 'action', id: pendingAction.card.id, target: pendingAction.selectedIds.join(',') })
    } else if (pendingAction.selectedId) {
      dispatch({ type: 'action', id: pendingAction.card.id, target: `${pendingAction.offered.id}:${pendingAction.selectedId}` })
    }
    setPendingAction(undefined)
  }

  return (
      <main>
        <header>
          <strong>Card Chess</strong>
          <span>
            {active ? 'Your turn' : 'Computer turn'} | {state.phase}
          </span>
          <button className="quiet" onClick={() => setHelp(true)}>
            Rules
          </button>
        </header>

        <OpponentHand count={opponentCardCount} />

        <div className="table">
          <aside>
            <b>Figure deck</b>
            <DeckBack
              image={figureBack}
              count={state.figures.draw.length}
              label={state.phase === 'start' && active ? 'Draw card' : 'Cards'}
              button
              drawing={drawing}
              highlight={mustDraw}
              disabled={!active || state.phase !== 'start'}
              onClick={drawCard}
            />
            <small>Discard: {state.figures.discard.length}</small>
          </aside>

          <div className="board">
            <Chessboard
              id="game"
              position={toFen(state.board)}
              onPieceDrop={onDrop}
              onSquareClick={(square) => {
                if (!active || !selectedCard) return
                if (selected) {
                  dispatch({ type: 'move', move: { from: selected, to: square as Square } })
                  setSelected(undefined)
                } else if (state.board[square as Square]?.color === 'white') {
                  setSelected(square as Square)
                }
              }}
              boardOrientation="white"
              arePiecesDraggable={active && !!selectedCard}
            />
          </div>

          <aside>
            <b>Action deck</b>
            <DeckBack image={actionBack} count={state.actions.draw.length} label="Cards" />
            <small>Discard: {state.actions.discard.length}</small>
          </aside>
        </div>

        <div className="player-panel">
          <section className="hand">
            <h2>Your figure cards</h2>
            <div>
            {sortedFigures(me.figures).map((card) => (
                <Card
                  key={card.id}
                  card={card}
                  active={card.id === state.selectedCardId}
                  playable={playableFigures(state, 'white').some((item) => item.id === card.id)}
                  disabled={!canSelectFigureCards}
                  onClick={() => canSelectFigureCards && dispatch({ type: 'select', id: card.id })}
                />
              ))}
            </div>

            <h2>Your action cards</h2>
            <div>
              {sortedActions(me.actions).map((card) => (
                <Card
                  key={card.id}
                  card={card}
                  playable={playableAction(state, card)}
                  disabled={!active || !playableAction(state, card)}
                  infoOpen={openActionInfoId === card.id}
                  onInfoClick={() => setOpenActionInfoId((current) => (current === card.id ? undefined : card.id))}
                  onClick={() => active && playableAction(state, card) && act(card)}
                />
              ))}
            </div>

            <div className="targets">
              <label>
                Reinforce square <input data-reinforce placeholder="e2" />
              </label>
              <label>
                Block square <input data-block placeholder="e7" />
              </label>
            </div>
          </section>

          {canEndWithoutMove && (
            <div className="turn-actions">
              <button className="end" onClick={() => dispatch({ type: 'end' })}>
                End turn
              </button>
            </div>
          )}
        </div>

        {state.message && <p className="message">{uiMessage(state.message)}</p>}
        {state.result && (
          <div className="overlay">
            <div>
              <h2>{state.result.winner === 'white' ? 'You win' : 'Computer wins'}</h2>
              <p>The king was captured.</p>
              <button onClick={() => dispatch({ type: 'start' })}>New game</button>
            </div>
          </div>
        )}
        {pendingAction && (
          <ActionDialog
            pending={pendingAction}
            figureCards={me.figures}
            onToggleExchange={(id) =>
              setPendingAction((current) => {
                if (!current || current.type !== 'exchange') return current
                const selectedIds = current.selectedIds.includes(id)
                  ? current.selectedIds.filter((selectedId) => selectedId !== id)
                  : current.selectedIds.length < 3
                    ? [...current.selectedIds, id]
                    : current.selectedIds
                return { ...current, selectedIds }
              })
            }
            onSelectTrade={(id) =>
              setPendingAction((current) => (current && current.type === 'trade' ? { ...current, selectedId: id } : current))
            }
            onCancel={() => setPendingAction(undefined)}
            onConfirm={confirmPendingAction}
          />
        )}
        {help && <Help close={() => setHelp(false)} />}
      </main>
  )
}

export default App
