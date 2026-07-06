import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createAuthOwnerNamespace,
  createGuestLocalOwnerId,
  createGuestOwnerNamespace,
  type LocalOwnerId,
  type OwnerNamespace,
} from '@nexvoy/core/local-first/guestIdentity'

const GUEST_OWNER_ID_STORAGE_KEY = 'onvoy.localFirst.guestOwnerId'
const PROMOTION_MARKER_PREFIX = 'onvoy.localFirst.promotion.'

export interface WebOwnerContext {
  namespace: OwnerNamespace
  ownerId: string
  authUserId: string | null
  isGuest: boolean
}

export interface GuestPromotionMarker {
  documentId: string
  status: 'pending' | 'completed' | 'failed' | 'conflict'
  updatedAt: string
  errorCode?: string
}

export async function resolveWebOwnerContext(supabase: SupabaseClient): Promise<WebOwnerContext> {
  const authUserId = await getCurrentUserId(supabase)
  if (authUserId) {
    return {
      namespace: createAuthOwnerNamespace(authUserId),
      ownerId: authUserId,
      authUserId,
      isGuest: false,
    }
  }

  const localOwnerId = getOrCreateGuestLocalOwnerId()
  return {
    namespace: createGuestOwnerNamespace(localOwnerId),
    ownerId: localOwnerId,
    authUserId: null,
    isGuest: true,
  }
}

export function getOrCreateGuestLocalOwnerId(): LocalOwnerId {
  if (typeof window === 'undefined') return createGuestLocalOwnerId('server')
  const existing = window.localStorage.getItem(GUEST_OWNER_ID_STORAGE_KEY)
  if (existing) return createGuestLocalOwnerId(existing)
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const localOwnerId = createGuestLocalOwnerId(id)
  window.localStorage.setItem(GUEST_OWNER_ID_STORAGE_KEY, localOwnerId)
  return localOwnerId
}

export function getGuestOwnerNamespace(): OwnerNamespace {
  return createGuestOwnerNamespace(getOrCreateGuestLocalOwnerId())
}

export function saveGuestPromotionMarker(marker: GuestPromotionMarker): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(
    `${PROMOTION_MARKER_PREFIX}${marker.documentId}`,
    JSON.stringify(marker),
  )
}

export function loadGuestPromotionMarkers(): GuestPromotionMarker[] {
  if (typeof window === 'undefined') return []
  const markers: GuestPromotionMarker[] = []
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key?.startsWith(PROMOTION_MARKER_PREFIX)) continue
    const raw = window.localStorage.getItem(key)
    if (!raw) continue
    try {
      markers.push(JSON.parse(raw) as GuestPromotionMarker)
    } catch {
      window.localStorage.removeItem(key)
    }
  }
  return markers
}

export function removeGuestPromotionMarker(documentId: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(`${PROMOTION_MARKER_PREFIX}${documentId}`)
}

async function getCurrentUserId(supabase: SupabaseClient): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getUser()
    return data.user?.id ?? null
  } catch {
    return null
  }
}
