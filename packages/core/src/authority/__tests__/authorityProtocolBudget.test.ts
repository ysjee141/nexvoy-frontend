import assert from 'node:assert/strict'
import type { AuthorityCommand } from '../serverAuthorityTypes'
import { utf8JsonByteLength } from '../serverAuthoritySync'
import { toAuthorityWireCommand } from '../../supabase/serverAuthorityRepository'

const createdAt = '2026-07-23T12:34:56.000Z'
const resourceId = '56000000-0000-0000-0000-000000000001'

const commands: AuthorityCommand[] = [
  {
    operationId: '56000000-0000-0000-0000-000000000011',
    resourceId,
    entityType: 'plan',
    entityId: '56000000-0000-0000-0000-000000000021',
    action: 'upsert',
    expectedVersion: 4,
    createdAt,
    payload: {
      title: '전주 한옥마을 산책과 저녁 식사',
      category: 'sightseeing',
      memo: '입장 시간과 동행자 도착 시간을 확인하고 현장에서 예약 번호를 확인합니다.',
      start_datetime_local: '2026-08-14T14:30:00',
      end_datetime_local: '2026-08-14T18:00:00',
      timezone: 'Asia/Seoul',
      latitude: 35.8149,
      longitude: 127.1513,
    },
  },
  {
    operationId: '56000000-0000-0000-0000-000000000012',
    resourceId,
    entityType: 'checklist_item',
    entityId: '56000000-0000-0000-0000-000000000022',
    action: 'upsert',
    expectedVersion: 2,
    createdAt,
    payload: {
      item_name: '여권과 숙소 예약 확인서',
      category: 'documents',
      quantity: 3,
      is_private: false,
    },
  },
  {
    operationId: '56000000-0000-0000-0000-000000000013',
    resourceId,
    entityType: 'template_item',
    entityId: '56000000-0000-0000-0000-000000000023',
    action: 'upsert',
    expectedVersion: 1,
    createdAt,
    payload: {
      item_name: '비상약과 개인 복용약',
      category: 'health',
      is_private: true,
      sort_order: 12,
    },
  },
]

for (const command of commands) {
  const bytes = utf8JsonByteLength(toAuthorityWireCommand(command))
  assert.ok(bytes <= 2_048, `${command.entityType} command exceeds 2 KiB: ${bytes}`)
}

const invalidationPayload = {
  resource_type: 'trip',
  resource_id: resourceId,
  revision: 42,
  change_count: 3,
  changed_entities: commands.slice(0, 2).map((command) => ({
    entity_type: command.entityType,
    entity_id: command.entityId,
    action: command.action,
  })),
  updated_at: createdAt,
}
assert.ok(
  utf8JsonByteLength(invalidationPayload) <= 1_024,
  'Representative invalidation payload exceeds 1 KiB.',
)
assert.equal(utf8JsonByteLength({ value: '온여정' }), Buffer.byteLength(JSON.stringify({ value: '온여정' })))

console.log('authority protocol budget tests passed')
