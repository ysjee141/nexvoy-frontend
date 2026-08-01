import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createChecklistCategory,
  getChecklistCategories,
} from '@nexvoy/core'
import type { ChecklistCategory } from '@nexvoy/types'

const LOCAL_CATEGORY_TIMESTAMP = '1970-01-01T00:00:00.000Z'

export function readChecklistCategoryCatalog(
  supabase: SupabaseClient,
  userId: string,
): Promise<ChecklistCategory[]> {
  return getChecklistCategories(supabase, userId)
}

export function persistChecklistCategory(input: {
  supabase: SupabaseClient
  userId: string
  name: string
  sortOrder: number
}): Promise<ChecklistCategory> {
  return createChecklistCategory(input.supabase, {
    user_id: input.userId,
    name: input.name,
    sort_order: input.sortOrder,
  })
}

export function mergeChecklistCategories(
  categories: ChecklistCategory[],
  categoryNames: string[],
  userId: string | null,
): ChecklistCategory[] {
  const merged: ChecklistCategory[] = []
  const seen = new Set<string>()
  const add = (category: ChecklistCategory) => {
    const key = category.name.trim().toLowerCase()
    if (!key || seen.has(key)) return
    seen.add(key)
    merged.push(category)
  }

  categories.forEach(add)
  const baseSortOrder = categories.reduce(
    (maximum, category) => Math.max(maximum, category.sort_order ?? 0),
    0,
  )
  const localCategoryNames = ['기타', ...categoryNames]
  localCategoryNames.forEach((name, index) => {
    const normalizedName = name.trim()
    if (!normalizedName) return
    add({
      id: `local:${encodeURIComponent(normalizedName.toLowerCase())}`,
      user_id: userId,
      name: normalizedName,
      sort_order: baseSortOrder + ((index + 1) * 10),
      created_at: LOCAL_CATEGORY_TIMESTAMP,
      updated_at: LOCAL_CATEGORY_TIMESTAMP,
    })
  })
  return merged
}
