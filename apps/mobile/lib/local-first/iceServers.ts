import {
  createStunOnlyIceServerConfigResponse,
  hasTurnServer,
  normalizeIceServerConfigs,
  shouldRefreshIceConfig,
  type IceServerConfigResponse,
  type P2PObservabilityEvent,
} from '@nexvoy/core/sync/iceServers'
import { supabase } from '@/lib/supabase'

let cachedIceConfig: IceServerConfigResponse | null = null

export interface FetchMobileIceServerConfigOptions {
  forceRefresh?: boolean
  platform?: P2PObservabilityEvent['platform']
  onEvent?: (event: P2PObservabilityEvent) => void
}

export async function fetchMobileIceServerConfig(
  options: FetchMobileIceServerConfigOptions = {},
): Promise<IceServerConfigResponse> {
  if (!options.forceRefresh && cachedIceConfig && !shouldRefreshIceConfig(cachedIceConfig)) {
    return cachedIceConfig
  }

  const platform = options.platform ?? 'unknown'
  try {
    const { data, error } = await supabase.functions.invoke('ice-servers', {
      method: 'POST',
      body: {},
    })

    if (error) {
      throw error
    }

    cachedIceConfig = normalizeIceConfigResponse(data)
    options.onEvent?.({
      name: 'p2p_ice_config_fetched',
      platform,
      provider: cachedIceConfig.provider,
      hasTurn: hasTurnServer(cachedIceConfig.iceServers),
      ttlSeconds: cachedIceConfig.ttlSeconds,
      fallback: cachedIceConfig.fallback,
    })
    return cachedIceConfig
  } catch (error) {
    const fallback = createStunOnlyIceServerConfigResponse({ ttlSeconds: 120 })
    cachedIceConfig = fallback
    options.onEvent?.({
      name: 'p2p_ice_config_failed',
      platform,
      provider: fallback.provider,
      fallback: fallback.fallback,
      reason: error instanceof Error ? error.name : 'unknown',
    })
    return fallback
  }
}

export function clearMobileIceServerConfigCache(): void {
  cachedIceConfig = null
}

function normalizeIceConfigResponse(input: unknown): IceServerConfigResponse {
  if (!isRecord(input)) {
    throw new Error('invalid_ice_config_response')
  }

  const iceServers = normalizeIceServerConfigs(input.iceServers)
  if (iceServers.length === 0) {
    throw new Error('ice_servers_missing')
  }

  if (input.provider !== 'cloudflare') {
    throw new Error('ice_provider_invalid')
  }

  if (input.fallback !== 'none' && input.fallback !== 'stun-only') {
    throw new Error('ice_fallback_invalid')
  }

  if (typeof input.issuedAt !== 'string' || typeof input.expiresAt !== 'string') {
    throw new Error('ice_expiry_invalid')
  }

  return {
    iceServers,
    provider: input.provider,
    fallback: input.fallback,
    ttlSeconds: typeof input.ttlSeconds === 'number' ? input.ttlSeconds : 3600,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
  }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null
}
