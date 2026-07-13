export interface P2PReconnectPolicy {
  maxAttempts: number
  initialDelayMs: number
  maxDelayMs: number
  multiplier: number
}

export const DEFAULT_P2P_RECONNECT_POLICY: P2PReconnectPolicy = {
  maxAttempts: 3,
  initialDelayMs: 1_000,
  maxDelayMs: 10_000,
  multiplier: 2,
}

export function normalizeP2PReconnectPolicy(
  input: Partial<P2PReconnectPolicy> = {},
): P2PReconnectPolicy {
  const maxAttempts = normalizePositiveInteger(input.maxAttempts, DEFAULT_P2P_RECONNECT_POLICY.maxAttempts)
  const initialDelayMs = normalizePositiveInteger(input.initialDelayMs, DEFAULT_P2P_RECONNECT_POLICY.initialDelayMs)
  const maxDelayMs = normalizePositiveInteger(input.maxDelayMs, DEFAULT_P2P_RECONNECT_POLICY.maxDelayMs)
  const multiplier = Number.isFinite(input.multiplier) && Number(input.multiplier) >= 1
    ? Number(input.multiplier)
    : DEFAULT_P2P_RECONNECT_POLICY.multiplier

  return {
    maxAttempts,
    initialDelayMs,
    maxDelayMs: Math.max(initialDelayMs, maxDelayMs),
    multiplier,
  }
}

export function getP2PReconnectDelayMs(
  attempt: number,
  policy: Partial<P2PReconnectPolicy> = {},
): number {
  const normalized = normalizeP2PReconnectPolicy(policy)
  const safeAttempt = Math.max(1, Math.floor(Number.isFinite(attempt) ? Number(attempt) : 1))
  const delay = normalized.initialDelayMs * (normalized.multiplier ** (safeAttempt - 1))
  return Math.min(normalized.maxDelayMs, Math.floor(delay))
}

export function canAttemptP2PReconnect(
  nextAttempt: number,
  policy: Partial<P2PReconnectPolicy> = {},
): boolean {
  const normalized = normalizeP2PReconnectPolicy(policy)
  return nextAttempt >= 1 && nextAttempt <= normalized.maxAttempts
}

function normalizePositiveInteger(input: number | null | undefined, fallback: number): number {
  return Number.isFinite(input) && Number(input) > 0
    ? Math.floor(Number(input))
    : fallback
}
