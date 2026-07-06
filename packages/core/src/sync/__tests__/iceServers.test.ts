import {
  CLOUDFLARE_STUN_URL,
  MAX_CLOUDFLARE_TURN_TTL_SECONDS,
  MIN_ICE_CONFIG_TTL_SECONDS,
  clampIceConfigTtl,
  createStunOnlyIceServerConfigResponse,
  filterIceServersForPlatform,
  hasTurnServer,
  normalizeIceServerConfigs,
  shouldRefreshIceConfig,
} from '../iceServers'

const stunOnly = createStunOnlyIceServerConfigResponse({
  now: new Date('2026-07-06T00:00:00.000Z'),
  ttlSeconds: 300,
})

if (stunOnly.fallback !== 'stun-only' || stunOnly.iceServers[0]?.urls !== CLOUDFLARE_STUN_URL) {
  throw new Error('STUN-only response should use the Cloudflare STUN default.')
}

if (stunOnly.expiresAt !== '2026-07-06T00:05:00.000Z') {
  throw new Error('STUN-only response should calculate expiresAt from issuedAt and TTL.')
}

if (clampIceConfigTtl(1) !== MIN_ICE_CONFIG_TTL_SECONDS) {
  throw new Error('TTL should be clamped to the minimum.')
}

if (clampIceConfigTtl(999999) !== MAX_CLOUDFLARE_TURN_TTL_SECONDS) {
  throw new Error('TTL should be clamped to Cloudflare max.')
}

const normalized = normalizeIceServerConfigs([
  { urls: 'stun:stun.cloudflare.com:3478' },
  {
    urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turn:turn.cloudflare.com:53?transport=tcp'],
    username: 'user',
    credential: 'secret',
    credentialType: 'password',
  },
  { urls: [] },
  { notUrls: 'ignored' },
])

if (normalized.length !== 2 || !hasTurnServer(normalized)) {
  throw new Error('ICE normalization should keep valid STUN/TURN entries only.')
}

const browserSafe = filterIceServersForPlatform(normalized)
const flattenedUrls = browserSafe.flatMap((server) => Array.isArray(server.urls) ? server.urls : [server.urls])
if (flattenedUrls.some((url) => url.includes(':53'))) {
  throw new Error('Browser-safe filtering should drop port 53 ICE URLs.')
}

if (!shouldRefreshIceConfig(stunOnly, new Date('2026-07-06T00:04:30.000Z'))) {
  throw new Error('ICE config should refresh inside the default skew window.')
}

if (shouldRefreshIceConfig(stunOnly, new Date('2026-07-06T00:03:00.000Z'))) {
  throw new Error('ICE config should not refresh before the skew window.')
}
