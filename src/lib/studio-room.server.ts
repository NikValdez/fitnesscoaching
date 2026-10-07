import { DurableObject } from 'cloudflare:workers'
import * as Y from 'yjs'
import { db, withIsolatedDatabaseRequest } from './db.server'
import { seedStudioDocument, mergeStudioUpdate } from './studio-document'
import {
  toBase64,
  fromBase64,
  awarenessFrame,
  readAwarenessFrame,
  type StudioChannel,
} from './studio-protocol'

type Connection = {
  session: string
  name: string
  client: number
  channel: StudioChannel
  clock: number
  awareness?: string
}

export class AdminStudio extends DurableObject {
  private document = new Y.Doc()
  private messages: { ws: WebSocket; message: string | ArrayBuffer }[] = []
  private processing?: Promise<void>

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env)
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(
        'CREATE TABLE IF NOT EXISTS scratch_snapshot (part INTEGER PRIMARY KEY, data BLOB NOT NULL)',
      )
      const rows = ctx.storage.sql
        .exec<{ data: ArrayBuffer }>('SELECT data FROM scratch_snapshot ORDER BY part')
        .toArray()
      if (rows.length) {
        const bytes = new Uint8Array(rows.reduce((size, row) => size + row.data.byteLength, 0))
        let offset = 0
        for (const row of rows) {
          bytes.set(new Uint8Array(row.data), offset)
          offset += row.data.byteLength
        }
        Y.applyUpdate(this.document, bytes)
      } else {
        const pad = await withIsolatedDatabaseRequest(() =>
          db.contentPad.findUniqueOrThrow({ where: { id: 'main' } }),
        )
        const initial = seedStudioDocument(pad)
        Y.applyUpdate(this.document, Y.encodeStateAsUpdate(initial))
        initial.destroy()
        this.persist(Y.encodeStateAsUpdate(this.document))
      }
    })
  }

  private persist(bytes: Uint8Array) {
    // Chunk snapshots so long documents and their CRDT history remain durable.
    this.ctx.storage.transactionSync(() => {
      this.ctx.storage.sql.exec('DELETE FROM scratch_snapshot')
      for (let offset = 0; offset < bytes.length; offset += 64000) {
        this.ctx.storage.sql.exec(
          'INSERT INTO scratch_snapshot (part, data) VALUES (?, ?)',
          offset / 64000,
          bytes.slice(offset, offset + 64000),
        )
      }
    })
  }

  private send(ws: WebSocket, message: unknown) {
    try {
      ws.send(JSON.stringify(message))
    } catch {
      /* Closing connections are pruned by the runtime. */
    }
  }

  private broadcast(message: unknown, except?: WebSocket, channel?: StudioChannel) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws !== except && (!channel || ws.deserializeAttachment()?.channel === channel))
        this.send(ws, message)
    }
  }

  private async authorizedConnections() {
    const sockets = this.ctx.getWebSockets()
    const ids = sockets.map((ws) => (ws.deserializeAttachment() as Connection).session)
    const sessions = await withIsolatedDatabaseRequest(() =>
      db.session.findMany({
        where: { id: { in: ids }, expiresAt: { gt: new Date() }, user: { role: 'ADMIN' } },
        select: { id: true },
      }),
    )
    const active = new Set(sessions.map((session) => session.id))
    for (const ws of sockets) {
      if (!active.has((ws.deserializeAttachment() as Connection).session)) {
        this.removePresence(ws)
        ws.close(4403, 'Admin access required.')
      }
    }
    return active
  }

  private presence() {
    const names = this.ctx
      .getWebSockets()
      .map((ws) => (ws.deserializeAttachment() as Connection).name)
    this.broadcast({ type: 'peers', names })
  }

  async fetch(request: Request) {
    const path = new URL(request.url).pathname
    if (['/board-changed', '/library-changed'].includes(path) && request.method === 'POST') {
      await this.authorizedConnections()
      const channel = path === '/library-changed' ? 'library' : 'board'
      this.broadcast({ type: channel }, undefined, channel)
      return new Response(null, { status: 204 })
    }
    const session = request.headers.get('X-Studio-Session')
    const name = request.headers.get('X-Studio-Name')
    const clientId = Number(request.headers.get('X-Studio-Client'))
    if (
      !session ||
      !name ||
      !Number.isSafeInteger(clientId) ||
      clientId < 0 ||
      clientId > 4294967295
    )
      return new Response('Forbidden', { status: 403 })
    const requested = request.headers.get('X-Studio-Channel')
    const channel: StudioChannel =
      requested === 'board' || requested === 'library' ? requested : 'pad'
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    server.serializeAttachment({
      session,
      name: decodeURIComponent(name),
      client: clientId,
      channel,
      clock: 0,
    } satisfies Connection)
    this.ctx.acceptWebSocket(server)
    await this.authorizedConnections()
    this.send(server, {
      type: 'sync',
      update: channel === 'pad' ? toBase64(Y.encodeStateAsUpdate(this.document)) : null,
      vector: channel === 'pad' ? toBase64(Y.encodeStateVector(this.document)) : null,
    })
    if (channel === 'pad') {
      for (const ws of this.ctx.getWebSockets()) {
        const awareness = (ws.deserializeAttachment() as Connection).awareness
        if (awareness) this.send(server, { type: 'awareness', update: awareness })
      }
    }
    this.presence()
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    this.messages.push({ ws, message })
    this.processing ??= this.drainMessages().finally(() => {
      this.processing = undefined
    })
    await this.processing
  }

  private async drainMessages() {
    while (this.messages.length) {
      let active: Set<string>
      try {
        // Keystrokes arriving during the access check form one batch. Every
        // batch checks current roles, without a network round trip per cursor.
        active = await this.authorizedConnections()
      } catch {
        for (const { ws } of this.messages.splice(0))
          ws.close(1011, 'Could not check admin access. Reconnect to try again.')
        continue
      }
      for (const { ws, message } of this.messages.splice(0)) {
        this.applyMessage(ws, message, active)
      }
    }
  }

  private applyMessage(ws: WebSocket, message: string | ArrayBuffer, active: Set<string>) {
    try {
      if (ws.readyState !== WebSocket.OPEN) return
      const connection = ws.deserializeAttachment() as Connection
      if (!active.has(connection.session)) return
      if (typeof message !== 'string' || message.length > 1500000)
        throw new Error('Invalid message.')
      const data = JSON.parse(message)
      if (data.type === 'ping') {
        this.send(ws, { type: 'pong' })
        return
      }
      if (connection.channel !== 'pad') throw new Error('Invalid channel.')
      if (data.type === 'awareness' && typeof data.update === 'string') {
        const presence = readAwarenessFrame(
          fromBase64(data.update),
          connection.client,
          connection.name,
        )
        if (presence.clock < connection.clock) return
        const update = toBase64(presence.update)
        ws.serializeAttachment({ ...connection, clock: presence.clock, awareness: update })
        this.broadcast({ type: 'awareness', update }, ws, 'pad')
      } else if (
        data.type === 'update' &&
        typeof data.update === 'string' &&
        Number.isSafeInteger(data.seq) &&
        data.seq > 0
      ) {
        const update = fromBase64(data.update)
        const next = mergeStudioUpdate(this.document, update)
        try {
          this.persist(Y.encodeStateAsUpdate(next))
        } finally {
          next.destroy()
        }
        Y.applyUpdate(this.document, update)
        this.broadcast({ type: 'update', update: data.update }, ws, 'pad')
        // Acknowledge only after the merged document is durably stored.
        this.send(ws, { type: 'ack', seq: data.seq })
      } else throw new Error('Invalid message.')
    } catch (error) {
      this.send(ws, {
        type: 'error',
        message: error instanceof Error ? error.message : 'Could not save changes.',
      })
      ws.close(4400, 'Resynchronize before sending more changes.')
    }
  }

  private removePresence(ws: WebSocket) {
    const connection = ws.deserializeAttachment() as Connection
    if (connection.awareness)
      this.broadcast(
        {
          type: 'awareness',
          update: toBase64(awarenessFrame(connection.client, connection.clock + 1, null)),
        },
        ws,
        'pad',
      )
  }

  webSocketClose(ws: WebSocket) {
    this.removePresence(ws)
    this.presence()
  }
  webSocketError(ws: WebSocket) {
    this.removePresence(ws)
    ws.close(1011, 'Connection interrupted.')
  }
}
