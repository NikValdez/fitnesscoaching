import { useEffect, useState, useSyncExternalStore } from 'react'
import { StudioProvider } from '../lib/studio-provider'
import type { StudioChannel } from '../lib/studio-protocol'

export function useStudio(channel: StudioChannel) {
  const [provider, setProvider] = useState<StudioProvider | null>(null)
  useEffect(() => {
    const live = new StudioProvider(channel)
    setProvider(live)
    live.start()
    return () => live.destroy()
  }, [channel])
  return provider
}

const waiting = {
  phase: 'connecting' as const,
  synced: false,
  dirty: false,
  peers: [] as string[],
  error: '',
}
const subscribe = () => () => {}
const getWaiting = () => waiting
export function useStudioState(provider: StudioProvider | null) {
  return useSyncExternalStore(
    provider?.subscribe ?? subscribe,
    provider?.getSnapshot ?? getWaiting,
    getWaiting,
  )
}
