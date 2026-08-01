import assert from 'node:assert/strict'
import test from 'node:test'
import type { ChecklistCategory } from '@nexvoy/types'
import { mergeChecklistCategories } from '../../checklistCategoryCatalog'

const REMOTE_CATEGORY: ChecklistCategory = {
  id: 'category-1',
  user_id: 'user-1',
  name: '서류',
  sort_order: 10,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
}

test('merges canonical item categories into an offline catalog', () => {
  const categories = mergeChecklistCategories(
    [REMOTE_CATEGORY],
    ['서류', '의류', '의류'],
    'user-1',
  )

  assert.deepEqual(categories.map((category) => category.name), ['서류', '기타', '의류'])
  assert.equal(categories[0]?.id, 'category-1')
  assert.equal(categories[2]?.id.startsWith('local:'), true)
})

test('provides a stable fallback category without a network catalog', () => {
  const first = mergeChecklistCategories([], [], 'user-1')
  const second = mergeChecklistCategories([], [], 'user-1')

  assert.equal(first[0]?.name, '기타')
  assert.equal(first[0]?.id, second[0]?.id)
})
