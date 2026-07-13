import {
  canAttemptP2PReconnect,
  getP2PReconnectDelayMs,
  normalizeP2PReconnectPolicy,
} from '../p2pLifecycle'

const policy = normalizeP2PReconnectPolicy({
  maxAttempts: 4,
  initialDelayMs: 500,
  maxDelayMs: 5_000,
  multiplier: 3,
})

if (policy.maxAttempts !== 4 || policy.initialDelayMs !== 500 || policy.maxDelayMs !== 5_000 || policy.multiplier !== 3) {
  throw new Error('P2P reconnect policy should normalize valid custom values.')
}

if (getP2PReconnectDelayMs(1, policy) !== 500) {
  throw new Error('First reconnect attempt should use the initial delay.')
}

if (getP2PReconnectDelayMs(3, policy) !== 4_500) {
  throw new Error('Reconnect delay should grow exponentially by multiplier.')
}

if (getP2PReconnectDelayMs(4, policy) !== 5_000) {
  throw new Error('Reconnect delay should clamp to maxDelayMs.')
}

if (!canAttemptP2PReconnect(4, policy) || canAttemptP2PReconnect(5, policy)) {
  throw new Error('Reconnect attempts should be bounded by maxAttempts.')
}

const normalized = normalizeP2PReconnectPolicy({
  maxAttempts: -1,
  initialDelayMs: 2_000,
  maxDelayMs: 100,
  multiplier: 0,
})

if (normalized.maxAttempts !== 3 || normalized.maxDelayMs !== 2_000 || normalized.multiplier !== 2) {
  throw new Error('Invalid reconnect policy values should fall back or clamp safely.')
}
