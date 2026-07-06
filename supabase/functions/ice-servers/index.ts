import { createClient } from 'npm:@supabase/supabase-js@2'

const CLOUDFLARE_STUN_URL = 'stun:stun.cloudflare.com:3478'
const DEFAULT_TTL_SECONDS = 3600
const MIN_TTL_SECONDS = 60
const MAX_CLOUDFLARE_TTL_SECONDS = 172800

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface IceServerConfig {
  urls: string | string[]
  username?: string
  credential?: string
  credentialType?: 'password' | 'oauth'
}

interface IceServerConfigResponse {
  iceServers: IceServerConfig[]
  provider: 'cloudflare'
  fallback: 'none' | 'stun-only'
  ttlSeconds: number
  issuedAt: string
  expiresAt: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return jsonResponse({}, 204)
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  const allowUnauthenticated = Deno.env.get('ICE_CONFIG_ALLOW_UNAUTHENTICATED') === 'true'
  const authorization = req.headers.get('Authorization')
  if (!allowUnauthenticated) {
    const authResult = await verifyAuthenticatedUser(authorization)
    if (!authResult.ok) {
      return jsonResponse({ error: authResult.error }, authResult.status)
    }
  }

  const ttlSeconds = resolveTtlSeconds()
  const keyId = Deno.env.get('CLOUDFLARE_TURN_KEY_ID')
  const keySecret = Deno.env.get('CLOUDFLARE_TURN_KEY_SECRET')

  if (!keyId || !keySecret) {
    console.warn('[ice-servers] Cloudflare TURN credentials are missing; returning STUN-only fallback.')
    return jsonResponse(createResponse({ ttlSeconds, fallback: 'stun-only' }), 200)
  }

  try {
    const cloudflareResponse = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${keySecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: ttlSeconds }),
      },
    )

    if (!cloudflareResponse.ok) {
      console.warn('[ice-servers] Cloudflare TURN credential request failed.', {
        status: cloudflareResponse.status,
      })
      return jsonResponse(createResponse({ ttlSeconds, fallback: 'stun-only' }), 200)
    }

    const payload = await cloudflareResponse.json()
    const turnIceServers = extractIceServers(payload)
    if (turnIceServers.length === 0) {
      console.warn('[ice-servers] Cloudflare TURN response did not contain valid ICE servers.')
      return jsonResponse(createResponse({ ttlSeconds, fallback: 'stun-only' }), 200)
    }

    return jsonResponse(createResponse({
      ttlSeconds,
      fallback: 'none',
      iceServers: dedupeIceServers([{ urls: CLOUDFLARE_STUN_URL }, ...turnIceServers]),
    }), 200)
  } catch (error) {
    console.warn('[ice-servers] Cloudflare TURN credential request errored.', {
      errorName: error instanceof Error ? error.name : 'unknown',
    })
    return jsonResponse(createResponse({ ttlSeconds, fallback: 'stun-only' }), 200)
  }
})

function createResponse(input: {
  ttlSeconds: number
  fallback: IceServerConfigResponse['fallback']
  iceServers?: IceServerConfig[]
}): IceServerConfigResponse {
  const issuedAt = new Date()
  const expiresAt = new Date(issuedAt.getTime() + input.ttlSeconds * 1000)

  return {
    iceServers: input.iceServers ?? [{ urls: CLOUDFLARE_STUN_URL }],
    provider: 'cloudflare',
    fallback: input.fallback,
    ttlSeconds: input.ttlSeconds,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  }
}

function resolveTtlSeconds(): number {
  const configured = Number(Deno.env.get('ICE_CONFIG_TTL_SECONDS') ?? DEFAULT_TTL_SECONDS)
  const rawValue = Number.isFinite(configured) ? configured : DEFAULT_TTL_SECONDS
  return Math.min(MAX_CLOUDFLARE_TTL_SECONDS, Math.max(MIN_TTL_SECONDS, Math.floor(rawValue)))
}

async function verifyAuthenticatedUser(
  authorization: string | null,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!authorization?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'authorization_required' }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[ice-servers] Supabase auth env is missing.')
    return { ok: false, status: 500, error: 'auth_config_missing' }
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authorization },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    return { ok: false, status: 401, error: 'authenticated_user_required' }
  }

  return { ok: true }
}

function extractIceServers(payload: unknown): IceServerConfig[] {
  const direct = normalizeIceServers(payload)
  if (direct.length > 0) return direct

  if (!isRecord(payload)) return []

  const candidates = collectIceServerCandidates(payload)
  for (const candidate of candidates) {
    const iceServers = normalizeIceServers(candidate)
    if (iceServers.length > 0) return iceServers
  }

  console.warn('[ice-servers] Cloudflare TURN response shape was not recognized.', {
    topLevelKeys: Object.keys(payload),
  })
  return []
}

function collectIceServerCandidates(input: unknown, depth = 0): unknown[] {
  if (depth > 4) return []
  if (!isRecord(input) && !Array.isArray(input)) return []

  const candidates: unknown[] = []
  if (isRecord(input)) {
    if ('iceServers' in input) candidates.push(input.iceServers)
    if ('ice_servers' in input) candidates.push(input.ice_servers)
    if ('iceServer' in input) candidates.push(input.iceServer)
    if ('ice_server' in input) candidates.push(input.ice_server)

    for (const value of Object.values(input)) {
      if (isRecord(value) || Array.isArray(value)) {
        candidates.push(...collectIceServerCandidates(value, depth + 1))
      }
    }
  }

  if (Array.isArray(input)) {
    for (const value of input) {
      if (isRecord(value) || Array.isArray(value)) {
        candidates.push(...collectIceServerCandidates(value, depth + 1))
      }
    }
  }

  return candidates
}

function normalizeIceServers(input: unknown): IceServerConfig[] {
  if (Array.isArray(input)) {
    return input
      .map((entry) => normalizeIceServer(entry))
      .filter((entry): entry is IceServerConfig => entry !== null)
  }

  if (isRecord(input)) {
    const iceServer = normalizeIceServer(input)
    return iceServer ? [iceServer] : []
  }

  return []
}

function normalizeIceServer(input: unknown): IceServerConfig | null {
  if (!isRecord(input)) return null

  const urls = normalizeUrls(input.urls)
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

function dedupeIceServers(iceServers: IceServerConfig[]): IceServerConfig[] {
  const seenUrls = new Set<string>()
  const result: IceServerConfig[] = []

  for (const iceServer of iceServers) {
    const urls = Array.isArray(iceServer.urls) ? iceServer.urls : [iceServer.urls]
    const uniqueUrls = urls.filter((url) => {
      if (seenUrls.has(url)) return false
      seenUrls.add(url)
      return true
    })
    if (uniqueUrls.length === 0) continue

    result.push({
      ...iceServer,
      urls: uniqueUrls.length === 1 ? uniqueUrls[0] : uniqueUrls,
    })
  }

  return result
}

function normalizeUrls(input: unknown): string | string[] | null {
  if (typeof input === 'string' && input.length > 0) return input
  if (!Array.isArray(input)) return null

  const urls = input.filter((url): url is string => typeof url === 'string' && url.length > 0)
  if (urls.length === 0) return null
  return urls.length === 1 ? urls[0] : urls
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null
}
