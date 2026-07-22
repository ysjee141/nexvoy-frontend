import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AuthorityConflictResolution,
  AuthorityProductSyncSnapshot,
  AuthorityResourceType,
} from '@nexvoy/core'
import type { ProductRepositoryBundle } from '@nexvoy/core/product/repositories'
import {
  createMobileAuthorityDocumentRepositories,
  createMobileAuthorityTemplate,
  createMobileAuthorityTrip,
  getMobileAuthoritySyncSnapshot,
  refreshMobileAuthorityList,
  resolveMobileAuthorityConflict,
  subscribeMobileAuthorityAccount,
  subscribeMobileAuthorityResource,
} from './authorityProductRepositories'

export function createMobileProductRepositories(
  supabase: SupabaseClient,
  options: { actorRole?: 'owner' | 'editor' | 'viewer' | null } = {},
): Promise<ProductRepositoryBundle> {
  return createMobileAuthorityDocumentRepositories(supabase, options)
}

export function createMobileProductTrip(input: {
  supabase: SupabaseClient
  destination: string
  startDate: string
  endDate: string
  adultsCount: number
  childrenCount: number
}): Promise<string> {
  return createMobileAuthorityTrip(input)
}

export function createMobileProductTemplate(input: {
  supabase: SupabaseClient
  title: string
  items: Array<{ item_name: string; category: string; is_private?: boolean }>
}): Promise<string> {
  return createMobileAuthorityTemplate(input)
}

export function subscribeMobileProductResource(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
  resourceId: string,
  listener: () => void,
): Promise<() => Promise<void>> {
  return subscribeMobileAuthorityResource(supabase, resourceType, resourceId, listener)
}

export function subscribeMobileProductAccount(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
  listener: () => void,
): Promise<() => void> {
  return subscribeMobileAuthorityAccount(supabase, resourceType, listener)
}

export function refreshMobileProductList(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
): Promise<unknown> {
  return refreshMobileAuthorityList(supabase, resourceType)
}

export function getMobileProductSyncSnapshot(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
  resourceId: string,
): Promise<AuthorityProductSyncSnapshot> {
  return getMobileAuthoritySyncSnapshot(supabase, resourceType, resourceId)
}

export function resolveMobileProductConflict(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
  resourceId: string,
  resolution: AuthorityConflictResolution,
): Promise<void> {
  return resolveMobileAuthorityConflict(supabase, resourceType, resourceId, resolution)
}
