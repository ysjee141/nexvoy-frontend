import type { SupabaseClient } from '@supabase/supabase-js'
import type { AuthorityProductSyncSnapshot, AuthorityResourceType } from '@nexvoy/core'
import type { ChecklistRepository, TripRepository } from '@nexvoy/core/repositories/types'
import type { ProductRepositoryBundle } from '@nexvoy/core/product/repositories'
import {
  createWebAuthorityDocumentRepositories,
  createWebAuthorityTemplate,
  createWebAuthorityTrip,
  getWebAuthoritySyncSnapshot,
  refreshWebAuthorityList,
  subscribeWebAuthorityAccount,
  subscribeWebAuthorityResource,
} from './authorityProductRepositories'
import { createWebAuthorityChecklistRepository } from './authorityChecklistRepository'
import { createWebAuthorityTripRepository } from './authorityTripRepository'

export interface WebRepositories {
  trips: TripRepository
  checklists: ChecklistRepository
}

export function createWebRepositories(supabase: SupabaseClient): WebRepositories {
  return {
    trips: createWebAuthorityTripRepository(supabase),
    checklists: createWebAuthorityChecklistRepository(supabase),
  }
}

export function createWebProductDocumentRepositories(
  supabase: SupabaseClient,
  options: { actorRole?: 'owner' | 'editor' | 'viewer' | null } = {},
): Promise<ProductRepositoryBundle> {
  return createWebAuthorityDocumentRepositories(supabase, options)
}

export function createWebProductTrip(input: {
  supabase: SupabaseClient
  destination: string
  startDate: string
  endDate: string
  adultsCount: number
  childrenCount: number
}): Promise<string> {
  return createWebAuthorityTrip(input)
}

export function createWebProductTemplate(input: {
  supabase: SupabaseClient
  title: string
  items: Array<{ item_name: string; category: string; is_private?: boolean }>
}): Promise<string> {
  return createWebAuthorityTemplate(input)
}

export function subscribeWebProductResource(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
  resourceId: string,
  listener: () => void,
): Promise<() => Promise<void>> {
  return subscribeWebAuthorityResource(supabase, resourceType, resourceId, listener)
}

export function subscribeWebProductAccount(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
  listener: () => void,
): Promise<() => void> {
  return subscribeWebAuthorityAccount(supabase, resourceType, listener)
}

export function refreshWebProductList(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
): Promise<unknown> {
  return refreshWebAuthorityList(supabase, resourceType)
}

export function getWebProductSyncSnapshot(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
  resourceId: string,
): Promise<AuthorityProductSyncSnapshot> {
  return getWebAuthoritySyncSnapshot(supabase, resourceType, resourceId)
}
