import { neonConfig } from '@neondatabase/serverless'

const originalTransport = {
  wsProxy: neonConfig.wsProxy,
  useSecureWebSocket: neonConfig.useSecureWebSocket,
  forceDisablePgSSL: neonConfig.forceDisablePgSSL,
  pipelineConnect: neonConfig.pipelineConnect,
}

// Optional loopback bridge for isolated local integration tests. Production
// connections retain Neon's default transport and never use this setting.
export function configureLocalNeon(
  connectionString: string | undefined,
  proxy: string | undefined,
) {
  if (!proxy) {
    Object.assign(neonConfig, originalTransport)
    return
  }
  const host = new URL(connectionString || '').hostname
  if (!['localhost', '127.0.0.1'].includes(host) || !/^127\.0\.0\.1:\d+$/.test(proxy))
    throw new Error('The local database bridge requires loopback addresses.')
  neonConfig.wsProxy = () => proxy
  neonConfig.useSecureWebSocket = false
  neonConfig.forceDisablePgSSL = true
  neonConfig.pipelineConnect = false
}
