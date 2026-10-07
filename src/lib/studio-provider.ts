import * as Y from 'yjs'
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness'
import { fromBase64, toBase64, type StudioState } from './studio-protocol'

const initial: StudioState = {
  phase: 'connecting',
  synced: false,
  dirty: false,
  peers: [],
  error: '',
}

// One Yjs document per connection. Reconnection exchanges CRDT differences,
// so changes made in parallel or while offline merge without replacing text.
export class StudioProvider {
  readonly document = new Y.Doc()
  readonly awareness = new Awareness(this.document)
  private socket: WebSocket | null = null
  private stopped = false
  private sequence = 0
  private acknowledged = 0
  private connected = false
  private reconnectTimer?: ReturnType<typeof setTimeout>
  private heartbeat?: ReturnType<typeof setInterval>
  private updateTimer?: ReturnType<typeof setTimeout>
  private awarenessTimer?: ReturnType<typeof setTimeout>
  private updates: Uint8Array[] = []
  private attempts = 0
  private listeners = new Set<() => void>()
  private boardListeners = new Set<() => void>()
  private state = initial

  constructor(readonly channel: 'pad' | 'board') {
    this.document.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === this) return
      this.sequence++
      this.change({ dirty: true, phase: this.connected ? 'saving' : 'offline', error: '' })
      if (this.connected) {
        this.updates.push(update)
        this.updateTimer ??= setTimeout(this.sendUpdates, 100)
      }
    })
    this.awareness.on(
      'update',
      (
        { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
        origin: unknown,
      ) => {
        if (
          origin !== this &&
          this.connected &&
          [...added, ...updated, ...removed].includes(this.document.clientID)
        ) {
          this.awarenessTimer ??= setTimeout(() => {
            this.awarenessTimer = undefined
            if (this.connected) this.sendAwareness()
          }, 80)
        }
      },
    )
  }

  getSnapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  onBoard = (listener: () => void) => {
    this.boardListeners.add(listener)
    return () => {
      this.boardListeners.delete(listener)
    }
  }
  private change(state: Partial<StudioState>) {
    this.state = { ...this.state, ...state }
    this.listeners.forEach((listener) => listener())
  }
  private send(value: unknown) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(value))
  }
  private sendAwareness() {
    this.send({
      type: 'awareness',
      update: toBase64(encodeAwarenessUpdate(this.awareness, [this.document.clientID])),
    })
  }
  private sendUpdates = () => {
    clearTimeout(this.updateTimer)
    this.updateTimer = undefined
    if (!this.connected || !this.updates.length) return
    const update = Y.mergeUpdates(this.updates)
    this.updates = []
    this.send({ type: 'update', update: toBase64(update), seq: this.sequence })
  }

  start() {
    this.stopped = false
    window.addEventListener('online', this.retry)
    window.addEventListener('offline', this.offline)
    this.connect()
    this.heartbeat = setInterval(() => this.send({ type: 'ping' }), 20000)
  }

  private offline = () => {
    this.connected = false
    this.socket?.close()
    this.change({ phase: 'offline' })
  }
  retry = () => {
    if (this.stopped || this.state.phase === 'denied') return
    clearTimeout(this.reconnectTimer)
    this.socket?.close()
    this.socket = null
    this.connect()
  }

  private connect() {
    if (this.stopped || !navigator.onLine) return
    const url = new URL('/api/admin/live', window.location.href)
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    url.searchParams.set('channel', this.channel)
    url.searchParams.set('client', String(this.document.clientID))
    const socket = new WebSocket(url)
    this.socket = socket
    socket.onmessage = (event) => {
      if (this.socket !== socket) return
      try {
        const message = JSON.parse(event.data)
        if (message.type === 'sync') {
          clearTimeout(this.updateTimer)
          this.updateTimer = undefined
          this.updates = []
          if (this.channel === 'pad') Y.applyUpdate(this.document, fromBase64(message.update), this)
          this.connected = true
          this.attempts = 0
          this.change({
            synced: true,
            phase: this.sequence > this.acknowledged ? 'saving' : 'saved',
            error: '',
          })
          if (this.sequence > this.acknowledged) {
            this.send({
              type: 'update',
              update: toBase64(Y.encodeStateAsUpdate(this.document, fromBase64(message.vector))),
              seq: this.sequence,
            })
          }
          if (this.channel === 'pad') this.sendAwareness()
          this.boardListeners.forEach((listener) => listener())
        } else if (message.type === 'update')
          Y.applyUpdate(this.document, fromBase64(message.update), this)
        else if (message.type === 'awareness')
          applyAwarenessUpdate(this.awareness, fromBase64(message.update), this)
        else if (message.type === 'ack') {
          this.acknowledged = Math.max(this.acknowledged, message.seq)
          this.change({
            dirty: this.sequence > this.acknowledged,
            phase: this.sequence > this.acknowledged ? 'saving' : 'saved',
            error: '',
          })
        } else if (message.type === 'peers') this.change({ peers: message.names })
        else if (message.type === 'board') this.boardListeners.forEach((listener) => listener())
        else if (message.type === 'error') this.change({ phase: 'error', error: message.message })
      } catch {
        this.change({
          phase: 'error',
          error: 'Could not synchronize the workspace. Reconnect to try again.',
        })
      }
    }
    socket.onclose = (event) => {
      if (this.socket !== socket) return
      this.connected = false
      removeAwarenessStates(
        this.awareness,
        [...this.awareness.getStates().keys()].filter((id) => id !== this.document.clientID),
        this,
      )
      if (this.stopped) return
      if (event.code === 4403) {
        this.change({
          phase: 'denied',
          error: 'Your admin session ended. Sign in again to continue.',
        })
        return
      }
      this.change({ phase: 'offline', peers: [], error: '' })
      this.reconnectTimer = setTimeout(
        () => this.connect(),
        Math.min(10000, 500 * 2 ** this.attempts++),
      )
    }
    socket.onerror = () => {
      /* onclose schedules reconnection and preserves local changes. */
    }
  }

  async flush() {
    if (!this.state.dirty) return true
    this.sendUpdates()
    if (!this.connected) this.retry()
    return new Promise<boolean>((resolve) => {
      const stop = this.subscribe(() => {
        if (!this.state.dirty) {
          clearTimeout(timer)
          stop()
          resolve(true)
        }
      })
      const timer = setTimeout(() => {
        stop()
        resolve(!this.state.dirty)
      }, 3000)
    })
  }

  destroy() {
    this.stopped = true
    clearTimeout(this.reconnectTimer)
    clearInterval(this.heartbeat)
    clearTimeout(this.updateTimer)
    clearTimeout(this.awarenessTimer)
    window.removeEventListener('online', this.retry)
    window.removeEventListener('offline', this.offline)
    this.awareness.setLocalState(null)
    this.socket?.close(1000, 'Leaving workspace')
    this.socket = null
    this.awareness.destroy()
    this.document.destroy()
    this.listeners.clear()
    this.boardListeners.clear()
  }
}
