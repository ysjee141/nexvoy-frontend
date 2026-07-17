import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuthorityProductSyncSnapshot, AuthorityResourceType } from '@nexvoy/core'
import type { DocumentPrimaryRepositoryBundle } from '@nexvoy/core/repositories/documentPrimaryRepository'
import {
  createMobileDocumentPrimaryRepositories,
  createMobileTemplateDocument,
  createMobileTripDocument,
} from '@/lib/local-first/documentPrimaryRepositories'
import {
  createMobileAuthorityDocumentRepositories,
  createMobileAuthorityTemplate,
  createMobileAuthorityTrip,
  getMobileAuthoritySyncSnapshot,
  refreshMobileAuthorityList,
  subscribeMobileAuthorityAccount,
  subscribeMobileAuthorityResource,
} from './authorityProductRepositories'

export type MobileRepositoryMode = 'server-authority' | 'document-primary'

export function resolveMobileRepositoryMode(): MobileRepositoryMode {
  return process.env.EXPO_PUBLIC_MOBILE_SERVER_AUTHORITY === '0'
    ? 'document-primary'
    : 'server-authority'
}

export function isMobileServerAuthorityEnabled(): boolean {
  return resolveMobileRepositoryMode() === 'server-authority'
}

export function createMobileProductRepositories(
  supabase: SupabaseClient,
  options: { actorRole?: 'owner' | 'editor' | 'viewer' | null } = {},
): Promise<DocumentPrimaryRepositoryBundle> {
  return isMobileServerAuthorityEnabled()
    ? createMobileAuthorityDocumentRepositories(supabase, options)
    : createMobileDocumentPrimaryRepositories(supabase, options)
}

export function createMobileProductTrip(input: {
  supabase: SupabaseClient
  destination: string
  startDate: string
  endDate: string
  adultsCount: number
  childrenCount: number
}): Promise<string> {
  return isMobileServerAuthorityEnabled()
    ? createMobileAuthorityTrip(input)
    : createMobileTripDocument(input)
}

export function createMobileProductTemplate(input: {
  supabase: SupabaseClient
  title: string
  items: Array<{ item_name: string; category: string; is_private?: boolean }>
}): Promise<string> {
  return isMobileServerAuthorityEnabled()
    ? createMobileAuthorityTemplate(input)
    : createMobileTemplateDocument(input)
}

export function subscribeMobileProductResource(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
  resourceId: string,
  listener: () => void,
): Promise<() => Promise<void>> {
  return isMobileServerAuthorityEnabled()
    ? subscribeMobileAuthorityResource(supabase, resourceType, resourceId, listener)
    : Promise.resolve(async () => undefined)
}

export function subscribeMobileProductAccount(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
  listener: () => void,
): Promise<() => void> {
  return isMobileServerAuthorityEnabled()
    ? subscribeMobileAuthorityAccount(supabase, resourceType, listener)
    : Promise.resolve(() => undefined)
}

export function refreshMobileProductList(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
): Promise<unknown> {
  return isMobileServerAuthorityEnabled()
    ? refreshMobileAuthorityList(supabase, resourceType)
    : Promise.resolve([])
}

export function getMobileProductSyncSnapshot(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
  resourceId: string,
): Promise<AuthorityProductSyncSnapshot> {
  return isMobileServerAuthorityEnabled()
    ? getMobileAuthoritySyncSnapshot(supabase, resourceType, resourceId)
    : Promise.resolve({ status: 'synced', pendingCount: 0, lastError: null })
}
