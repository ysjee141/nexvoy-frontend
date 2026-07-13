import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createSupabaseLegacyRepositories,
  type LegacyRepositories,
} from '@nexvoy/core/supabase/legacyRepository'
import type { ChecklistRepository, TripRepository } from '@nexvoy/core/repositories/types'
import { createWebDualWriteChecklistRepository } from './dualWriteChecklistRepository'
import { createWebLocalFirstChecklistRepository } from './localFirstChecklistRepository'
import { createWebDocumentPrimaryChecklistRepository } from './documentPrimaryChecklistRepository'

export type WebRepositoryMode =
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
