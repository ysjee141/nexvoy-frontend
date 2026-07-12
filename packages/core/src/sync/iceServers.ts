export type IceServerProvider = 'cloudflare'

export type IceServerFallback = 'none' | 'stun-only'

export type IceServerPlatform = 'web' | 'ios' | 'android' | 'unknown'

export interface IceServerConfig {
  urls: string | string[]
  username?: string
  credential?: string
  credentialType?: 'password' | 'oauth'
}

export interface IceServerConfigResponse {
  iceServers: IceServerConfig[]
  provider: IceServerProvider
  fallback: IceServerFallback
  ttlSeconds: number
  issuedAt: string
  expiresAt: string
}

export type P2PObservabilityEventName =
  | 'p2p_ice_config_fetched'
  | 'p2p_ice_config_failed'
  | 'p2p_connected'
  | 'p2p_unavailable'
  | 'p2p_connection_failed'
  | 'p2p_relay_selected'
  | 'p2p_signaling_joined'
  | 'p2p_data_channel_open'

export interface P2PObservabilityEvent {
  name: P2PObservabilityEventName
  platform: IceServerPlatform
  provider?: IceServerProvider
  hasTurn?: boolean
  ttlSeconds?: number
  fallback?: IceServerFallback
  reason?: string
  connectionType?: 'direct' | 'relay' | 'unknown'
  setupMs?: number
  relayProtocol?: string
  relayTransport?: string
}

export const CLOUDFLARE_STUN_URL = 'stun:stun.cloudflare.com:3478'

export const CLOUDFLARE_STUN_ICE_SERVERS: readonly IceServerConfig[] = [
  { urls: CLOUDFLARE_STUN_URL },
]

export const DEFAULT_ICE_CONFIG_TTL_SECONDS = 3600
export const MIN_ICE_CONFIG_TTL_SECONDS = 60
export const MAX_CLOUDFLARE_TURN_TTL_SECONDS = 172800
export const ICE_CONFIG_REFRESH_SKEW_SECONDS = 60

export function clampIceConfigTtl(
  ttlSeconds: number | null | undefined,
  fallback = DEFAULT_ICE_CONFIG_TTL_SECONDS,
): number {
  const rawValue = Number.isFinite(ttlSeconds) ? Number(ttlSeconds) : fallback
  return Math.min(
    MAX_CLOUDFLARE_TURN_TTL_SECONDS,
    Math.max(MIN_ICE_CONFIG_TTL_SECONDS, Math.floor(rawValue)),
  )
}

export function createStunOnlyIceServerConfigResponse(
  input: {
    now?: Date
    ttlSeconds?: number
    provider?: IceServerProvider
  } = {},
): IceServerConfigResponse {
  const ttlSeconds = clampIceConfigTtl(input.ttlSeconds)
  const issuedAtDate = input.now ?? new Date()
  const expiresAtDate = new Date(issuedAtDate.getTime() + ttlSeconds * 1000)

  return {
    iceServers: [...CLOUDFLARE_STUN_ICE_SERVERS],
    provider: input.provider ?? 'cloudflare',
    fallback: 'stun-only',
    ttlSeconds,
    issuedAt: issuedAtDate.toISOString(),
    expiresAt: expiresAtDate.toISOString(),
  }
}

export function normalizeIceServerConfig(input: unknown): IceServerConfig | null {
  if (!isRecord(input)) return null

  const urls = normalizeIceServerUrls(input.urls)
  if (!urls) return null

  const config: IceServerConfig = { urls }
  if (typeof input.username === 'string' && input.username.length > 0) {
    config.username = input.username
  }
  if (typeof input.credential === 'string' && input.credential.length > 0) {
    config.credential = input.credential
  }
  if (input.credentialType === 'password' || input.credentialType === 'oauth') {
    config.credentialType = input.credentialType
  }

  return config
}

export function normalizeIceServerConfigs(input: unknown): IceServerConfig[] {
  if (!Array.isArray(input)) return []

  return input
    .map((entry) => normalizeIceServerConfig(entry))
    .filter((entry): entry is IceServerConfig => entry !== null)
}

export function filterIceServersForPlatform(
  iceServers: readonly IceServerConfig[],
  options: { allowPort53?: boolean } = {},
): IceServerConfig[] {
  if (options.allowPort53) return iceServers.map(cloneIceServer)

  return iceServers
    .map((iceServer) => {
      const urls = normalizeIceServerUrls(iceServer.urls)
      if (!urls) return null

      const filteredUrls = asArray(urls).filter((url) => !isPort53IceUrl(url))
      if (filteredUrls.length === 0) return null

      return {
        ...iceServer,
        urls: filteredUrls.length === 1 ? filteredUrls[0] : filteredUrls,
      }
    })
    .filter((entry): entry is IceServerConfig => entry !== null)
}

export function hasTurnServer(iceServers: readonly IceServerConfig[]): boolean {
  return iceServers.some((iceServer) =>
    asArray(iceServer.urls).some((url) => url.toLowerCase().startsWith('turn:') || url.toLowerCase().startsWith('turns:')),
  )
}

export function shouldRefreshIceConfig(
  response: Pick<IceServerConfigResponse, 'expiresAt'>,
  now = new Date(),
  skewSeconds = ICE_CONFIG_REFRESH_SKEW_SECONDS,
): boolean {
  const expiresAt = Date.parse(response.expiresAt)
  if (!Number.isFinite(expiresAt)) return true

  return expiresAt - now.getTime() <= skewSeconds * 1000
}

function normalizeIceServerUrls(input: unknown): string | string[] | null {
  if (typeof input === 'string' && input.length > 0) {
    return input
  }

  if (!Array.isArray(input)) return null

  const urls = input.filter((url): url is string => typeof url === 'string' && url.length > 0)
  if (urls.length === 0) return null
  return urls.length === 1 ? urls[0] : urls
}

function cloneIceServer(iceServer: IceServerConfig): IceServerConfig {
  return {
    ...iceServer,
    urls: Array.isArray(iceServer.urls) ? [...iceServer.urls] : iceServer.urls,
  }
}

function asArray(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value]
}

function isPort53IceUrl(url: string): boolean {
  return /:(53)(\?|$)/.test(url)
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null
}
