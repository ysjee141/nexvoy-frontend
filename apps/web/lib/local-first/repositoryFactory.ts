import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createSupabaseLegacyRepositories,
  type LegacyRepositories,
} from '@nexvoy/core/supabase/legacyRepository'
import type { ChecklistRepository, TripRepository } from '@nexvoy/core/repositories/types'
import { createWebDualWriteChecklistRepository } from './dualWriteChecklistRepository'
import { createWebLocalFirstChecklistRepository } from './localFirstChecklistRepository'
import { createWebDocumentPrimaryChecklistRepository } from './documentPrimaryChecklistRepository'
import {
  createWebAuthorityDocumentRepositories,
  createWebAuthorityTemplate,
  createWebAuthorityTrip,
  getWebAuthoritySyncSnapshot,
  refreshWebAuthorityList,
  subscribeWebAuthorityAccount,
  subscribeWebAuthorityResource,
} from '@/lib/data/authorityProductRepositories'
import { createWebAuthorityChecklistRepository } from '@/lib/data/authorityChecklistRepository'
import { createWebAuthorityTripRepository } from '@/lib/data/authorityTripRepository'
import {
  createWebDocumentPrimaryRepositories,
  createWebTemplateDocument,
  createWebTripDocument,
} from './documentPrimaryRepositories'
import type { AuthorityProductSyncSnapshot, AuthorityResourceType } from '@nexvoy/core'
import type { DocumentPrimaryRepositoryBundle } from '@nexvoy/core/repositories/documentPrimaryRepository'

export type WebRepositoryMode =
  | 'server-authority'
  | 'legacy-supabase'
  | 'document-primary'
  | 'local-first-checklist-spike'
  | 'local-first-checklist-dual-write'

export interface WebRepositories {
  mode: WebRepositoryMode
  trips: TripRepository
  checklists: ChecklistRepository
}

export function createWebRepositories(
  supabase: SupabaseClient,
  mode: WebRepositoryMode = resolveWebRepositoryMode(),
): WebRepositories {
  const legacyRepositories: LegacyRepositories = createSupabaseLegacyRepositories(supabase)

  switch (mode) {
    case 'server-authority':
      return {
        mode,
        trips: createWebAuthorityTripRepository(supabase),
        checklists: createWebAuthorityChecklistRepository(supabase),
      }
    case 'local-first-checklist-dual-write':
      return {
        ...legacyRepositories,
        mode,
        checklists: createWebDualWriteChecklistRepository(supabase),
      }
    case 'local-first-checklist-spike':
      return {
        ...legacyRepositories,
        mode,
        checklists: createWebLocalFirstChecklistRepository(supabase),
      }
    case 'document-primary':
      return {
        ...legacyRepositories,
        mode,
        checklists: createWebDocumentPrimaryChecklistRepository(supabase),
      }
    case 'legacy-supabase':
      return {
        ...legacyRepositories,
        mode,
      }
    default:
      return {
        ...legacyRepositories,
        mode: 'legacy-supabase',
      }
  }
}

export function resolveWebRepositoryMode(): WebRepositoryMode {
  if (process.env.NEXT_PUBLIC_WEB_SERVER_AUTHORITY === '1') return 'server-authority'
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    if (params.get('serverAuthority') === '1') {
      window.localStorage.removeItem('onvoy.webServerAuthorityDisabled')
      return 'server-authority'
    }
    if (params.get('serverAuthority') === '0') {
      window.localStorage.setItem('onvoy.webServerAuthorityDisabled', '1')
    }
    if (
      process.env.NEXT_PUBLIC_WEB_SERVER_AUTHORITY !== '0' &&
      window.localStorage.getItem('onvoy.webServerAuthorityDisabled') !== '1'
    ) {
      return 'server-authority'
    }
  } else if (process.env.NEXT_PUBLIC_WEB_SERVER_AUTHORITY !== '0') {
    return 'server-authority'
  }

  if (process.env.NEXT_PUBLIC_LOCAL_FIRST_CHECKLIST_DUAL_WRITE === '1') {
    return 'local-first-checklist-dual-write'
  }
  if (process.env.NEXT_PUBLIC_WEB_DOCUMENT_PRIMARY === '1') {
    return 'document-primary'
  }
  if (process.env.NEXT_PUBLIC_LOCAL_FIRST_CHECKLIST_SPIKE === '1') {
    return 'local-first-checklist-spike'
  }
  if (typeof window === 'undefined') return 'legacy-supabase'

  const params = new URLSearchParams(window.location.search)
  if (params.get('localFirstChecklistDualWrite') === '1') {
    window.localStorage.setItem('onvoy.localFirstChecklistDualWrite', '1')
    return 'local-first-checklist-dual-write'
  }
  if (params.get('localFirstChecklistDualWrite') === '0') {
    window.localStorage.removeItem('onvoy.localFirstChecklistDualWrite')
    return 'legacy-supabase'
  }
  if (params.get('localFirstChecklist') === '1') {
    window.localStorage.setItem('onvoy.localFirstChecklistSpike', '1')
    return 'local-first-checklist-spike'
  }
  if (params.get('documentPrimary') === '1') {
    window.localStorage.setItem('onvoy.webDocumentPrimary', '1')
    return 'document-primary'
  }
  if (params.get('documentPrimary') === '0') {
    window.localStorage.removeItem('onvoy.webDocumentPrimary')
    return 'legacy-supabase'
  }
  if (params.get('localFirstChecklist') === '0') {
    window.localStorage.removeItem('onvoy.localFirstChecklistSpike')
    return 'legacy-supabase'
  }

  if (window.localStorage.getItem('onvoy.localFirstChecklistDualWrite') === '1') {
    return 'local-first-checklist-dual-write'
  }
  if (window.localStorage.getItem('onvoy.webDocumentPrimary') === '1') {
    return 'document-primary'
  }

  return window.localStorage.getItem('onvoy.localFirstChecklistSpike') === '1'
    ? 'local-first-checklist-spike'
    : 'legacy-supabase'
}

export function isWebServerAuthorityEnabled(): boolean {
  return resolveWebRepositoryMode() === 'server-authority'
}

export async function createWebProductDocumentRepositories(
  supabase: SupabaseClient,
  options: { actorRole?: 'owner' | 'editor' | 'viewer' | null } = {},
): Promise<DocumentPrimaryRepositoryBundle> {
  return isWebServerAuthorityEnabled()
    ? createWebAuthorityDocumentRepositories(supabase, options)
    : createWebDocumentPrimaryRepositories(supabase, options)
}

export function createWebProductTrip(input: {
  supabase: SupabaseClient
  destination: string
  startDate: string
  endDate: string
  adultsCount: number
  childrenCount: number
}): Promise<string> {
  return isWebServerAuthorityEnabled()
    ? createWebAuthorityTrip(input)
    : createWebTripDocument(input)
}

export function createWebProductTemplate(input: {
  supabase: SupabaseClient
  title: string
  items: Array<{ item_name: string; category: string; is_private?: boolean }>
}): Promise<string> {
  return isWebServerAuthorityEnabled()
    ? createWebAuthorityTemplate(input)
    : createWebTemplateDocument(input)
}

export async function subscribeWebProductResource(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
  resourceId: string,
  listener: () => void,
): Promise<() => Promise<void>> {
  if (!isWebServerAuthorityEnabled()) return async () => undefined
  return subscribeWebAuthorityResource(supabase, resourceType, resourceId, listener)
}

export async function subscribeWebProductAccount(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
  listener: () => void,
): Promise<() => void> {
  if (!isWebServerAuthorityEnabled()) return () => undefined
  return subscribeWebAuthorityAccount(supabase, resourceType, listener)
}

export function refreshWebProductList(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
): Promise<unknown> {
  if (!isWebServerAuthorityEnabled()) return Promise.resolve([])
  return refreshWebAuthorityList(supabase, resourceType)
}

export function getWebProductSyncSnapshot(
  supabase: SupabaseClient,
  resourceType: AuthorityResourceType,
  resourceId: string,
): Promise<AuthorityProductSyncSnapshot> {
  if (!isWebServerAuthorityEnabled()) {
    return Promise.resolve({ status: 'synced', pendingCount: 0, lastError: null })
  }
  return getWebAuthoritySyncSnapshot(supabase, resourceType, resourceId)
}
