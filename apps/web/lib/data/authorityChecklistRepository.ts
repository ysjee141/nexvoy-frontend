import type { SupabaseClient } from '@supabase/supabase-js'
import type { ChecklistRepository } from '@nexvoy/core/repositories/types'
import { createWebChecklistRepository } from '@/lib/local-first/documentPrimaryChecklistRepository'
import { createWebAuthorityDocumentRepositories } from './authorityProductRepositories'

export function createWebAuthorityChecklistRepository(
  supabase: SupabaseClient,
): ChecklistRepository {
  return createWebChecklistRepository(supabase, createWebAuthorityDocumentRepositories)
}
