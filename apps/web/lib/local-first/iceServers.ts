import {
  createStunOnlyIceServerConfigResponse,
  filterIceServersForPlatform,
  hasTurnServer,
  normalizeIceServerConfigs,
  shouldRefreshIceConfig,
  type IceServerConfigResponse,
  type P2PObservabilityEvent,
} from '@nexvoy/core/sync/iceServers'
import { analytics } from '@/services/AnalyticsService'
import { createClient } from '@/lib/supabase/client'

let cachedIceConfig: IceServerConfigResponse | null = null

export interface FetchWebIceServerConfigOptions {
  forceRefresh?: boolean
}

export async function fetchWebIceServerConfig(
  options: FetchWebIceServerConfigOptions = {},
): Promise<IceServerConfigResponse> {
  if (!options.forceRefresh && cachedIceConfig && !shouldRefreshIceConfig(cachedIceConfig)) {
    return cachedIceConfig
  }

  if (typeof window === 'undefined') {
    return createStunOnlyIceServerConfigResponse()
  }

  try {
    const supabase = createClient()
    const { data, error } = await supabase.functions.invoke('ice-servers', {
      method: 'POST',
      body: {},
    })

    if (error) {
      throw error
    }

    const response = normalizeIceConfigResponse(data)
    cachedIceConfig = {
      ...response,
      iceServers: filterIceServersForPlatform(response.iceServers),
    }
    logP2PEvent({
      name: 'p2p_ice_config_fetched',
      platform: 'web',
      provider: cachedIceConfig.provider,
      hasTurn: hasTurnServer(cachedIceConfig.iceServers),
      ttlSeconds: cachedIceConfig.ttlSeconds,
      fallback: cachedIceConfig.fallback,
    })
    return cachedIceConfig
  } catch (error) {
    const fallback = createStunOnlyIceServerConfigResponse({ ttlSeconds: 120 })
    cachedIceConfig = fallback
    logP2PEvent({
      name: 'p2p_ice_config_failed',
      platform: 'web',
      provider: fallback.provider,
      fallback: fallback.fallback,
      reason: error instanceof Error ? error.name : 'unknown',
    })
    return fallback
  }
}

export function clearWebIceServerConfigCache(): void {
  cachedIceConfig = null
}

export function logP2PEvent(event: P2PObservabilityEvent): void {
  analytics.logP2PEvent(event)
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
