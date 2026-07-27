import { Chessboard } from 'react-chessboard'
import { useEffect, useMemo, useState } from 'react'
import actionBack from './assets/ui/cards/backs/action.svg'
import figureBack from './assets/ui/cards/backs/figure.svg'
import bishopCard from './assets/ui/cards/pieces/bishop.svg'
import kingCard from './assets/ui/cards/pieces/king.svg'
import knightCard from './assets/ui/cards/pieces/knight.svg'
import pawnCard from './assets/ui/cards/pieces/pawn.svg'
import queenCard from './assets/ui/cards/pieces/queen.svg'
import rookCard from './assets/ui/cards/pieces/rook.svg'
import jokerCard from './assets/ui/cards/special/joker.svg'
import type { ActionCard, FigureCard, FigureCardType, Move, Square } from './domain'
import { actionText } from './engine'
import type { OnlineClientMessage, OnlineServerMessage, PublicGameView } from './onlineTypes'

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

type PendingAction =
  | { type: 'exchange'; card: ActionCard; selectedIds: string[] }
  | { type: 'trade'; card: ActionCard; selectedId?: string }

const cardLabel = (card: FigureCard | ActionCard) =>
  card.kind === 'figure' ? `${card.type[0].toUpperCase()}${card.type.slice(1)}` : actionText[card.type][0]

const sortedFigures = (cards: FigureCard[]) =>
  [...cards].sort((a, b) => figureSortOrder[a.type] - figureSortOrder[b.type] || cardLabel(a).localeCompare(cardLabel(b)))

const sortedActions = (cards: ActionCard[]) => [...cards].sort((a, b) => cardLabel(a).localeCompare(cardLabel(b)))

const toFen = (board: PublicGameView['board']) => {
  const code: Record<string, string> = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' }

  return [8, 7, 6, 5, 4, 3, 2, 1]
    .map((rank) => {
      let out = ''
      let empty = 0
      for (const file of 'abcdefgh') {
        const piece = board[`${file}${rank}` as Square]
        if (!piece) empty++
        else {
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

function sendJson(socket: WebSocket | undefined, message: OnlineClientMessage) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
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

function DeckBack({ image, count, label, highlight, disabled, onClick }: {
  image: string
  count: number
  label: string
  highlight?: boolean
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button className={`deck ${highlight ? 'highlight' : ''}`} onClick={onClick} disabled={disabled}>
      <img src={image} alt="" draggable={false} />
      <span>{label}</span>
      <strong>{count}</strong>
    </button>
  )
}

function HiddenHand({ count }: { count: number }) {
  const visible = Math.min(count, 8)
  return (
    <div className="hidden-hand" aria-label={`${count} hidden opponent cards`}>
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
  )
}

function OnlineActionDialog({
  pending,
  view,
  onToggleExchange,
  onSelectTrade,
  onCancel,
  onConfirm,
}: {
  pending: PendingAction
  view: PublicGameView
  onToggleExchange: (id: string) => void
  onSelectTrade: (id: string) => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const isExchange = pending.type === 'exchange'
  const canConfirm = isExchange ? pending.selectedIds.length > 0 : !!pending.selectedId
  const figures = view.me?.figures ?? []

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
              {sortedFigures(figures).map((card) => (
                <Card key={card.id} card={card} active={pending.selectedIds.includes(card.id)} onClick={() => onToggleExchange(card.id)} />
              ))}
            </div>
          </>
        ) : (
          <>
            <p>The opponent offers this card. Choose one of yours to give back.</p>
            <div className="trade-offer">
              <div>
                <strong>Offer</strong>
                {view.pendingTrade && <Card card={view.pendingTrade.offered} active />}
              </div>
              <div>
                <strong>Your card</strong>
                <div className="dialog-cards compact">
                  {sortedFigures(figures).map((card) => (
                    <Card key={card.id} card={card} active={pending.selectedId === card.id} onClick={() => onSelectTrade(card.id)} />
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

function useOnlineRoom(roomId: string) {
  const [socket, setSocket] = useState<WebSocket>()
  const [view, setView] = useState<PublicGameView>()
  const [status, setStatus] = useState('Connecting')
  const [shareUrl, setShareUrl] = useState(`${window.location.origin}/online/${roomId}`)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const storageKey = `kartenschach:${roomId}:token`
    const token = params.get('token') ?? window.localStorage.getItem(storageKey)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = new URL(`${protocol}//${window.location.host}/ws/${roomId}`)
    if (token) wsUrl.searchParams.set('token', token)
    const nextSocket = new WebSocket(wsUrl)
    setSocket(nextSocket)
    setStatus('Connecting')

    nextSocket.onopen = () => setStatus('Connected')
    nextSocket.onclose = () => setStatus('Disconnected')
    nextSocket.onerror = () => setStatus('Connection error')
    nextSocket.onmessage = (event) => {
      const message = JSON.parse(event.data as string) as OnlineServerMessage
      if (message.type === 'welcome') {
        setShareUrl(message.shareUrl)
        if (message.token) window.localStorage.setItem(storageKey, message.token)
        if (message.token && !params.get('token')) {
          const nextUrl = new URL(window.location.href)
          nextUrl.searchParams.set('token', message.token)
          window.history.replaceState(null, '', nextUrl)
        }
      }
      if (message.type === 'view') setView(message.view)
      if (message.type === 'error') setStatus(message.message)
    }

    return () => nextSocket.close()
  }, [roomId])

  return { socket, status, view, shareUrl }
}

export default function OnlineGame({ roomId }: { roomId: string }) {
  const { socket, status, view, shareUrl } = useOnlineRoom(roomId)
  const [selected, setSelected] = useState<Square>()
  const [pendingAction, setPendingAction] = useState<PendingAction>()
  const [openActionInfoId, setOpenActionInfoId] = useState<string>()
  const isActive = !!view?.player && view.current === view.player && view.status !== 'waiting' && !view.result
  const mustDraw = isActive && view.phase === 'start'
  const canSelectFigureCards = isActive && !mustDraw
  const selectedCard = view?.me?.figures.find((card) => card.id === view.selectedCardId)
  const events = useMemo(() => [...(view?.events ?? [])].slice(-8).reverse(), [view?.events])

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
    if (view?.pendingTrade && pendingAction?.type !== 'trade') {
      const action = view.me?.actions.find((card) => card.id === view.pendingTrade?.actionId)
      if (action) setPendingAction({ type: 'trade', card: action })
    }
  }, [pendingAction?.type, view])

  if (!view) {
    return (
      <main className="start">
        <h1>Card Chess Online</h1>
        <p>{status}</p>
      </main>
    )
  }

  const act = (card: ActionCard) => {
    setOpenActionInfoId(undefined)
    if (card.type === 'exchange') {
      setPendingAction({ type: 'exchange', card, selectedIds: [] })
      return
    }
    if (card.type === 'trade') {
      sendJson(socket, { type: 'prepareTrade', id: card.id })
      return
    }
    sendJson(socket, { type: 'action', id: card.id })
  }

  const confirmPendingAction = () => {
    if (!pendingAction) return
    if (pendingAction.type === 'exchange') {
      sendJson(socket, { type: 'action', id: pendingAction.card.id, target: pendingAction.selectedIds.join(',') })
    } else if (pendingAction.selectedId) {
      sendJson(socket, { type: 'action', id: pendingAction.card.id, target: pendingAction.selectedId })
    }
    setPendingAction(undefined)
  }

  const move = (moveToSend: Move) => sendJson(socket, { type: 'move', move: moveToSend })

  return (
    <main>
      <header>
        <strong>Card Chess Online</strong>
        <span>
          {view.player ? `You are ${view.player}` : 'Spectating'} | {status}
        </span>
        <a className="button-link quiet" href="/">
          Local game
        </a>
      </header>

      <section className="online-status">
        <div>
          <b>{view.status === 'waiting' ? 'Waiting for second player' : view.result ? 'Game finished' : `${view.current} turn`}</b>
          <span>{view.phase}</span>
        </div>
        <label>
          Share link
          <input readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} />
        </label>
      </section>

      <section className="enemy">
        <span>Opponent hand</span>
        <HiddenHand count={view.opponent.figureCount + view.opponent.actionCount} />
        <strong>{view.opponent.connected ? 'Connected' : 'Waiting'}</strong>
      </section>

      <div className="table">
        <aside>
          <b>Figure deck</b>
          <DeckBack
            image={figureBack}
            count={view.decks.figures.draw}
            label={mustDraw ? 'Draw card' : 'Cards'}
            highlight={mustDraw}
            disabled={!mustDraw}
            onClick={() => sendJson(socket, { type: 'draw' })}
          />
          <small>Discard: {view.decks.figures.discard}</small>
        </aside>

        <div className="board">
          <Chessboard
            id="online-game"
            position={toFen(view.board)}
            onPieceDrop={(from, to) => {
              if (isActive) move({ from: from as Square, to: to as Square })
              return false
            }}
            onSquareClick={(square) => {
              if (!isActive || !selectedCard) return
              if (selected) {
                move({ from: selected, to: square as Square })
                setSelected(undefined)
              } else if (view.board[square as Square]?.color === view.player) {
                setSelected(square as Square)
              }
            }}
            boardOrientation={view.player ?? 'white'}
            arePiecesDraggable={isActive && !!selectedCard}
          />
        </div>

        <aside>
          <b>Action deck</b>
          <DeckBack image={actionBack} count={view.decks.actions.draw} label="Cards" disabled />
          <small>Discard: {view.decks.actions.discard}</small>
        </aside>
      </div>

      <div className="player-panel">
        <section className="hand">
          <h2>Your figure cards</h2>
          <div>
            {sortedFigures(view.me?.figures ?? []).map((card) => (
              <Card
                key={card.id}
                card={card}
                active={card.id === view.selectedCardId}
                playable={view.playableFigureIds.includes(card.id)}
                disabled={!canSelectFigureCards}
                onClick={() => canSelectFigureCards && sendJson(socket, { type: 'select', id: card.id })}
              />
            ))}
          </div>

          <h2>Your action cards</h2>
          <div>
            {sortedActions(view.me?.actions ?? []).map((card) => (
              <Card
                key={card.id}
                card={card}
                playable={view.playableActionIds.includes(card.id)}
                disabled={!isActive || !view.playableActionIds.includes(card.id)}
                infoOpen={openActionInfoId === card.id}
                onInfoClick={() => setOpenActionInfoId((current) => (current === card.id ? undefined : card.id))}
                onClick={() => isActive && view.playableActionIds.includes(card.id) && act(card)}
              />
            ))}
          </div>
        </section>

        {view.canEndWithoutMove && (
          <div className="turn-actions">
            <button className="end" onClick={() => sendJson(socket, { type: 'end' })}>
              End turn
            </button>
          </div>
        )}
      </div>

      <section className="event-log">
        <h2>Events</h2>
        {events.map((event) => (
          <p key={event.id}>{event.text}</p>
        ))}
      </section>

      {view.message && <p className="message">{view.message}</p>}
      {view.result && (
        <div className="overlay">
          <div>
            <h2>{view.result.winner === view.player ? 'You win' : `${view.result.winner} wins`}</h2>
            <p>The king was captured.</p>
          </div>
        </div>
      )}
      {pendingAction && (
        <OnlineActionDialog
          pending={pendingAction}
          view={view}
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
          onCancel={() => {
            sendJson(socket, { type: 'cancelPending' })
            setPendingAction(undefined)
          }}
          onConfirm={confirmPendingAction}
        />
      )}
    </main>
  )
}
