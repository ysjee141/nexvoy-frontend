import assert from 'node:assert/strict'
import type { AuthorityCommand, CanonicalResourceBundle } from '../serverAuthorityTypes'
import {
  applyOptimisticAuthorityCommandsToBundle,
  versionAuthorityCommandsForBundle,
} from '../serverAuthorityMaterialize'

const bundle: CanonicalResourceBundle = {
  resourceType: 'trip',
  resourceId: 'trip-1',
  revision: 7,
  serverUpdatedAt: '2026-07-23T00:00:00.000Z',
  data: {
    trip: {
      id: 'trip-1',
      destination: 'Seoul',
      version: 3,
      created_at: '2026-07-20T00:00:00.000Z',
      updated_at: '2026-07-20T00:00:00.000Z',
      deleted_at: null,
    },
    plans: [{
      id: 'plan-1',
      trip_id: 'trip-1',
      title: 'Lunch',
      version: 2,
      created_at: '2026-07-20T00:00:00.000Z',
      updated_at: '2026-07-20T00:00:00.000Z',
      deleted_at: null,
    }],
    checklist_items: [{
      id: 'item-1',
      checklist_id: 'checklist-1',
      item_name: 'Passport',
      version: 4,
      created_at: '2026-07-20T00:00:00.000Z',
      updated_at: '2026-07-20T00:00:00.000Z',
      deleted_at: null,
    }],
    checklist_item_assignees: [],
    checklist_item_user_checks: [],
  },
}

function command(
  operationId: string,
  entityType: AuthorityCommand['entityType'],
  entityId: string,
  action: AuthorityCommand['action'],
  payload: AuthorityCommand['payload'],
): AuthorityCommand {
  return {
    operationId,
    resourceId: 'trip-1',
    entityType,
    entityId,
    action,
    payload,
    createdAt: '2026-07-23T00:00:01.000Z',
  } as AuthorityCommand
}

const commands: AuthorityCommand[] = [
  command('op-1', 'plan', 'plan-1', 'upsert', { memo: 'first' }),
  command('op-2', 'plan', 'plan-1', 'upsert', { memo: 'second' }),
  command('op-3', 'plan', 'plan-2', 'upsert', { title: 'Dinner' }),
  command('op-4', 'plan', 'plan-2', 'upsert', { memo: 'reserved' }),
  command('op-5', 'checklist_item', 'item-1', 'upsert', { category: 'Documents' }),
  command('op-6', 'checklist_item_assignees', 'item-1', 'set', { user_ids: ['user-1'] }),
  command('op-7', 'checklist_item_user_check', 'item-1', 'set', {
    user_id: 'user-1',
    checked: true,
  }),
]

const versioned = versionAuthorityCommandsForBundle(bundle, commands)
assert.deepEqual(
  versioned.map((item) => item.expectedVersion),
  [2, 3, undefined, 1, 4, undefined, undefined],
)

const optimistic = applyOptimisticAuthorityCommandsToBundle(
  bundle,
  versioned,
  '2026-07-23T00:00:02.000Z',
)
const plans = optimistic.data.plans as Array<Record<string, unknown>>
const checklistItems = optimistic.data.checklist_items as Array<Record<string, unknown>>
assert.equal(plans.find((item) => item.id === 'plan-1')?.version, 4)
assert.equal(plans.find((item) => item.id === 'plan-2')?.version, 2)
assert.equal(checklistItems.find((item) => item.id === 'item-1')?.version, 5)

console.log('server authority materialize tests passed')
