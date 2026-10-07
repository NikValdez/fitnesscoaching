export { toBase64, fromBase64 } from 'lib0/buffer'
import * as decoding from 'lib0/decoding'
import * as encoding from 'lib0/encoding'

export type StudioChannel = 'pad' | 'board' | 'library' | 'media'

export type StudioPhase = 'connecting' | 'saved' | 'saving' | 'offline' | 'error' | 'denied'
export type StudioState = {
  phase: StudioPhase
  synced: boolean
  dirty: boolean
  peers: string[]
  error: string
}

export function awarenessFrame(client: number, clock: number, state: unknown) {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, 1)
  encoding.writeVarUint(encoder, client)
  encoding.writeVarUint(encoder, clock)
  encoding.writeVarString(encoder, JSON.stringify(state))
  return encoding.toUint8Array(encoder)
}

export function readAwarenessFrame(update: Uint8Array, client: number, name: string) {
  if (update.byteLength > 16000) throw new Error('Presence is too large.')
  const decoder = decoding.createDecoder(update)
  if (decoding.readVarUint(decoder) !== 1 || decoding.readVarUint(decoder) !== client)
    throw new Error('Invalid presence.')
  const clock = decoding.readVarUint(decoder)
  const state = JSON.parse(decoding.readVarString(decoder))
  if (state !== null) {
    if (typeof state !== 'object' || Array.isArray(state)) throw new Error('Invalid presence.')
    const color =
      typeof state.user?.color === 'string' && /^#[0-9a-f]{6}$/i.test(state.user.color)
        ? state.user.color
        : '#2b4a7d'
    const position = (value: unknown) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false
      const pos = value as Record<string, unknown>
      return (
        Object.keys(pos).every((key) => ['type', 'tname', 'item', 'assoc'].includes(key)) &&
        (pos.tname == null || (typeof pos.tname === 'string' && pos.tname.length < 100)) &&
        (pos.assoc == null || Number.isSafeInteger(pos.assoc)) &&
        [pos.type, pos.item].every(
          (id) =>
            id == null ||
            (typeof id === 'object' &&
              Number.isSafeInteger((id as { client?: number }).client) &&
              Number.isSafeInteger((id as { clock?: number }).clock)),
        )
      )
    }
    if (state.cursor != null && (!position(state.cursor.anchor) || !position(state.cursor.head)))
      throw new Error('Invalid cursor.')
    return {
      clock,
      update: awarenessFrame(client, clock, {
        user: { name: name.slice(0, 80), color },
        ...(state.cursor ? { cursor: state.cursor } : {}),
      }),
    }
  }
  return { clock, update: awarenessFrame(client, clock, null) }
}
