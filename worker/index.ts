import type { ActionCard, GameState, PlayerColor, RandomSource } from '../src/domain'
import { other } from '../src/domain'
import {
  actionText,
  beginTurn,
  newGame,
  playableAction,
  playableFigures,
  playMove,
  selectFigureCard,
  skipFigureMove,
  useAction,
} from '../src/engine'
import type { CreateGameResponse, OnlineClientMessage, OnlineServerMessage, PublicEvent, PublicGameView } from '../src/onlineTypes'

interface Env {
  ASSETS: Fetcher
  GAME_ROOM: DurableObjectNamespace
}

interface RoomData {
  roomId: string
  game: GameState
  seats: Partial<Record<PlayerColor, string>>
  rngSeed: number
  events: PublicEvent[]
  nextEventId: number
  pendingTrades: Partial<Record<PlayerColor, { actionId: string; offeredId: string }>>
}

interface ClientAttachment {
  player?: PlayerColor
  token?: string
}

const colors: PlayerColor[] = ['white', 'black']
const inactiveEventLimit = 60
const base62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

const json = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })

const randomId = (length: number) => {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => base62[byte % base62.length]).join('')
}

const makeRandom = (data: RoomData): RandomSource => ({
  next: () => {
    data.rngSeed = (data.rngSeed * 1664525 + 1013904223) >>> 0
    return data.rngSeed / 4294967296
  },
})

const colorName = (color: PlayerColor) => (color === 'white' ? 'White' : 'Black')

const actionLabel = (card?: ActionCard) => (card ? actionText[card.type][0] : 'an action card')

const countCaptureCards = (type: string) => ({ pawn: 1, knight: 2, bishop: 2, rook: 3, queen: 5, king: 0 })[type] ?? 0

const redactMessage = (message: string | undefined, viewer?: PlayerColor, current?: PlayerColor) => {
  if (!message) return undefined
  if (message.startsWith('Opponent figure cards:')) return viewer === current ? message : undefined
  return message
}

export class GameRoom {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request) {
    const url = new URL(request.url)

    if (url.pathname.endsWith('/create')) {
      const data = await this.load(url.searchParams.get('roomId') ?? randomId(10))
      if (!data.seats.white) data.seats.white = randomId(24)
      this.addEvent(data, 'White created the room.')
      await this.save(data)
      return json({ roomId: data.roomId, player: 'white', token: data.seats.white })
    }

    if (request.headers.get('upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 })

    const data = await this.load(url.searchParams.get('roomId') ?? url.pathname.split('/').pop() ?? randomId(10))
    const requestedToken = url.searchParams.get('token') ?? undefined
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    const attachment = this.join(data, requestedToken)

    server.serializeAttachment(attachment)
    this.state.acceptWebSocket(server)

    if (attachment.player) {
      this.addEvent(data, `${colorName(attachment.player)} connected.`)
      if (data.seats.white && data.seats.black) this.addEvent(data, 'Both players are connected. The game can start.')
    }

    await this.save(data)
    this.send(server, {
      type: 'welcome',
      roomId: data.roomId,
      player: attachment.player,
      token: attachment.token,
      shareUrl: this.shareUrl(url, data.roomId),
    })
    await this.broadcast(data)

    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, rawMessage: string | ArrayBuffer) {
    const attachment = ws.deserializeAttachment() as ClientAttachment | undefined
    if (!attachment?.player || typeof rawMessage !== 'string') return

    const data = await this.load()
    let message: OnlineClientMessage
    try {
      message = JSON.parse(rawMessage) as OnlineClientMessage
    } catch {
      this.send(ws, { type: 'error', message: 'Could not read that command.' })
      return
    }

    const before = data.game
    const random = makeRandom(data)
    const player = attachment.player
    const roomIsPlaying = () => Boolean(data.seats.white && data.seats.black)
    const currentOnly = () => roomIsPlaying() && data.game.current === player && data.game.phase !== 'gameOver'

    if (message.type === 'draw') {
      if (data.game.current === player && data.game.phase === 'start') {
        data.game = beginTurn(data.game, random)
        this.addEvent(data, `${colorName(player)} drew a figure card.`)
      }
    }

    if (message.type === 'select' && currentOnly()) {
      data.game = selectFigureCard(data.game, message.id)
    }

    if (message.type === 'move' && currentOnly()) {
      const moving = data.game.board[message.move.from]
      const captured = data.game.board[message.move.to]
      data.game = playMove(data.game, message.move, random)
      if (data.game !== before && moving && !data.game.message) {
        const captureText = captured
          ? ` and captured a ${captured.color} ${captured.type}`
          : ''
        this.addEvent(data, `${colorName(player)} moved ${moving.type} from ${message.move.from} to ${message.move.to}${captureText}.`)
        if (captured && captured.type !== 'king') {
          this.addEvent(data, `${colorName(other(player))} drew ${countCaptureCards(captured.type)} action card(s).`)
        }
      }
      if (data.game.result) this.addEvent(data, `${colorName(data.game.result.winner)} won by capturing the king.`)
      data.pendingTrades = {}
    }

    if (message.type === 'end' && currentOnly() && (data.game.phase === 'actions' || data.game.phase === 'move')) {
      data.game = skipFigureMove(data.game, random)
      this.addEvent(data, `${colorName(player)} ended the turn and drew an action card.`)
      data.pendingTrades = {}
    }

    if (message.type === 'prepareTrade' && currentOnly()) {
      const card = data.game.players[player].actions.find((item) => item.id === message.id && item.type === 'trade')
      const opponentFigures = data.game.players[other(player)].figures
      if (card && playableAction(data.game, card) && opponentFigures.length) {
        const offered = opponentFigures[Math.floor(random.next() * opponentFigures.length)]
        data.pendingTrades[player] = { actionId: card.id, offeredId: offered.id }
      }
    }

    if (message.type === 'cancelPending') {
      delete data.pendingTrades[player]
    }

    if (message.type === 'action' && currentOnly()) {
      const card = data.game.players[player].actions.find((item) => item.id === message.id)
      let target = message.target
      if (card?.type === 'trade') {
        const pending = data.pendingTrades[player]
        const giveId = target
        target = pending?.actionId === card.id && giveId ? `${pending.offeredId}:${giveId}` : undefined
      }
      data.game = useAction(data.game, message.id, random, target)
      if (data.game !== before && !data.game.message) this.addEvent(data, `${colorName(player)} played ${actionLabel(card)}.`)
      delete data.pendingTrades[player]
    }

    await this.save(data)
    await this.broadcast(data)
  }

  async webSocketClose(ws: WebSocket) {
    const data = await this.load()
    const attachment = ws.deserializeAttachment() as ClientAttachment | undefined
    if (attachment?.player) this.addEvent(data, `${colorName(attachment.player)} disconnected.`)
    await this.save(data)
    await this.broadcast(data)
  }

  private async load(roomId = 'room'): Promise<RoomData> {
    const stored = await this.state.storage.get<RoomData>('room')
    if (stored) return stored

    const data: RoomData = {
      roomId,
      rngSeed: crypto.getRandomValues(new Uint32Array(1))[0] || 1,
      game: newGame(makeRandom({ rngSeed: 1 } as RoomData)),
      seats: {},
      events: [],
      nextEventId: 1,
      pendingTrades: {},
    }
    data.game = newGame(makeRandom(data))
    return data
  }

  private async save(data: RoomData) {
    data.events = data.events.slice(-inactiveEventLimit)
    await this.state.storage.put('room', data)
  }

  private join(data: RoomData, token?: string): ClientAttachment {
    for (const color of colors) {
      if (token && data.seats[color] === token) return { player: color, token }
    }

    const openSeat = colors.find((color) => !data.seats[color])
    if (!openSeat) return {}

    const issuedToken = randomId(24)
    data.seats[openSeat] = issuedToken
    return { player: openSeat, token: issuedToken }
  }

  private addEvent(data: RoomData, text: string) {
    if (data.events[data.events.length - 1]?.text === text) return
    data.events.push({ id: data.nextEventId++, text })
  }

  private viewFor(data: RoomData, viewer?: PlayerColor): PublicGameView {
    const opponent = viewer ? other(viewer) : 'black'
    const me = viewer ? data.game.players[viewer] : undefined
    const pendingTrade = viewer && data.pendingTrades[viewer]
    const offered =
      viewer && pendingTrade
        ? data.game.players[other(viewer)].figures.find((card) => card.id === pendingTrade.offeredId)
        : undefined
    const isCurrent = viewer === data.game.current

    return {
      roomId: data.roomId,
      player: viewer,
      status: data.game.result ? 'finished' : data.seats.white && data.seats.black ? 'playing' : 'waiting',
      board: data.game.board,
      current: data.game.current,
      phase: data.game.phase,
      turn: data.game.turn,
      result: data.game.result,
      message: redactMessage(data.game.message, viewer, data.game.current),
      selectedCardId: isCurrent ? data.game.selectedCardId : undefined,
      activeEffectType: data.game.activeEffect?.type,
      me: me ? { color: me.color, figures: me.figures, actions: me.actions } : undefined,
      opponent: {
        connected: this.connected(opponent),
        figureCount: viewer ? data.game.players[opponent].figures.length : 0,
        actionCount: viewer ? data.game.players[opponent].actions.length : 0,
      },
      decks: {
        figures: { draw: data.game.figures.draw.length, discard: data.game.figures.discard.length },
        actions: { draw: data.game.actions.draw.length, discard: data.game.actions.discard.length },
      },
      playableFigureIds: isCurrent ? playableFigures(data.game, viewer).map((card) => card.id) : [],
      playableActionIds: isCurrent ? me?.actions.filter((card) => playableAction(data.game, card)).map((card) => card.id) ?? [] : [],
      canEndWithoutMove: isCurrent && (data.game.phase === 'actions' || data.game.phase === 'move'),
      pendingTrade: pendingTrade && offered ? { actionId: pendingTrade.actionId, offered } : undefined,
      events: data.events,
    }
  }

  private async broadcast(data: RoomData) {
    for (const ws of this.state.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as ClientAttachment | undefined
      this.send(ws, { type: 'view', view: this.viewFor(data, attachment?.player) })
    }
  }

  private connected(color: PlayerColor) {
    return this.state.getWebSockets().some((ws) => (ws.deserializeAttachment() as ClientAttachment | undefined)?.player === color)
  }

  private send(ws: WebSocket, message: OnlineServerMessage) {
    try {
      ws.send(JSON.stringify(message))
    } catch {
      ws.close(1011, 'send failed')
    }
  }

  private shareUrl(url: URL, roomId: string) {
    return `${url.origin}/online/${roomId}`
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/games' && request.method === 'POST') {
      const roomId = randomId(10)
      const id = env.GAME_ROOM.idFromName(roomId)
      const stub = env.GAME_ROOM.get(id)
      const created = await stub.fetch(new URL(`/create?roomId=${roomId}`, url.origin))
      const body = (await created.json()) as { roomId: string; player: PlayerColor; token: string }
      const response: CreateGameResponse = {
        ...body,
        playUrl: `${url.origin}/online/${body.roomId}?token=${body.token}`,
        shareUrl: `${url.origin}/online/${body.roomId}`,
      }
      return json(response)
    }

    if (url.pathname.startsWith('/ws/')) {
      const roomId = url.pathname.split('/').filter(Boolean)[1]
      const id = env.GAME_ROOM.idFromName(roomId)
      const stub = env.GAME_ROOM.get(id)
      url.searchParams.set('roomId', roomId)
      return stub.fetch(new Request(url, request))
    }

    return env.ASSETS.fetch(request)
  },
}
