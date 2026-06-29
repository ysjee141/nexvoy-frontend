import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createSupabaseLegacyRepositories,
  type LegacyRepositories,
} from '@nexvoy/core/supabase/legacyRepository'

export type WebRepositoryMode = 'legacy-supabase'

export function createWebRepositories(
  supabase: SupabaseClient,
  mode: WebRepositoryMode = 'legacy-supabase',
): LegacyRepositories {
  switch (mode) {
    case 'legacy-supabase':
      return createSupabaseLegacyRepositories(supabase)
    default:
      return createSupabaseLegacyRepositories(supabase)
  }
}
