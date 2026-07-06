import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createDualWriteChecklistRepository,
  createSupabaseLegacyRepositories,
  type ChecklistRepository,
  type DualWriteMismatchEvent,
} from '@nexvoy/core'
import { analytics } from '@/services/AnalyticsService'
import { createWebChecklistDocumentWriter } from './checklistDocumentWriter'

export function createWebDualWriteChecklistRepository(
  supabase: SupabaseClient,
): ChecklistRepository {
  const legacyRepositories = createSupabaseLegacyRepositories(supabase)
  return createDualWriteChecklistRepository({
    legacy: legacyRepositories.checklists,
    local: createWebChecklistDocumentWriter(supabase),
    reporter: reportDualWriteMismatch,
  })
}

function reportDualWriteMismatch(event: DualWriteMismatchEvent): void {
  analytics.logDualWriteMismatch(event)
}
