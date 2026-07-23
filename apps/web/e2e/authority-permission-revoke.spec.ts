import { randomUUID } from 'node:crypto'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/auth'
import type { TestUser } from './helpers/supabase'
import {
  cleanupTripsByUser,
  createAuthenticatedTestClient,
  getChecklistItemByName,
  getOrCreateChecklist,
  revokeAuthorityDocumentMember,
  seedAuthorityDocumentMember,
  seedAuthorityTrip,
  setAuthorityDocumentMemberRole,
} from './helpers/seed'

test.describe('TASK-058 permission and revoke authority', () => {
  test('NEW-A03 viewer writes are blocked by both the UI and command RPC', async ({
    createAuthenticatedContextFor,
    multiUsers,
  }) => {
    await cleanupTripsByUser(multiUsers.owner.id)
    const trip = await seedAuthorityTrip(multiUsers.owner, {
      destination: 'TASK-058 뷰어 권한',
    })
    await seedAuthorityDocumentMember(trip.id, multiUsers.viewer, 'viewer')

    try {
      const viewerContext = await createAuthenticatedContextFor(multiUsers.viewer)
      const viewerPage = await viewerContext.newPage()
      await viewerPage.goto(`/trips/detail?id=${trip.id}&tab=plans&serverAuthority=1`)
      await expect(viewerPage.getByRole('heading', {
        name: 'TASK-058 뷰어 권한 여행',
        exact: true,
      })).toBeVisible({ timeout: 15000 })
      await expect(viewerPage.getByRole('button', { name: '일정 추가' })).toHaveCount(0)

      expect(await attemptPlanWrite(multiUsers.viewer, trip.id)).toMatch(
        /authority_trip_(write_)?forbidden/,
      )
    } finally {
      await cleanupTripsByUser(multiUsers.owner.id)
    }
  })

  test('NEW-A04 editor downgrade is reflected on an active screen and blocks the next command', async ({
    createAuthenticatedContextFor,
    multiUsers,
  }) => {
    await cleanupTripsByUser(multiUsers.owner.id)
    const trip = await seedAuthorityTrip(multiUsers.owner, {
      destination: 'TASK-058 권한 하향',
    })
    const member = await seedAuthorityDocumentMember(trip.id, multiUsers.editor, 'editor')

    try {
      const editorContext = await createAuthenticatedContextFor(multiUsers.editor)
      const editorPage = await editorContext.newPage()
      await editorPage.goto(`/trips/detail?id=${trip.id}&tab=plans&serverAuthority=1`)
      await expect(editorPage.getByRole('heading', {
        name: 'TASK-058 권한 하향 여행',
        exact: true,
      })).toBeVisible({ timeout: 15000 })
      await expect(editorPage.getByRole('button', { name: '일정 추가' })).toBeVisible()
      await editorPage.waitForTimeout(1000)

      await setAuthorityDocumentMemberRole(multiUsers.owner, member.id, 'viewer')

      await expect(editorPage.getByRole('button', { name: '일정 추가' })).toHaveCount(0, {
        timeout: 15000,
      })
      expect(await attemptPlanWrite(multiUsers.editor, trip.id)).toMatch(
        /authority_trip_(write_)?forbidden/,
      )
    } finally {
      await cleanupTripsByUser(multiUsers.owner.id)
    }
  })

  test('NEW-A05 revoked offline work is rejected and its local resource and outbox are purged', async ({
    createAuthenticatedContextFor,
    multiUsers,
  }) => {
    await cleanupTripsByUser(multiUsers.owner.id)
    const trip = await seedAuthorityTrip(multiUsers.owner, {
      destination: 'TASK-058 오프라인 회수',
    })
    const member = await seedAuthorityDocumentMember(trip.id, multiUsers.editor, 'editor')
    const checklist = await getOrCreateChecklist(trip.id)

    try {
      const editorContext = await createAuthenticatedContextFor(multiUsers.editor)
      const editorPage = await editorContext.newPage()
      await editorPage.goto(`/trips/detail?id=${trip.id}&tab=checklist&serverAuthority=1`)
      await expect(editorPage.getByRole('heading', {
        name: 'TASK-058 오프라인 회수 여행',
        exact: true,
      })).toBeVisible({ timeout: 15000 })

      await editorContext.setOffline(true)
      await editorPage.getByRole('button', { name: '항목 추가' }).click()
      const itemName = `회수 전 오프라인 항목 ${Date.now()}`
      await editorPage.getByPlaceholder('어떤 준비물인가요?').fill(itemName)
      await editorPage.getByRole('button', { name: '추가', exact: true }).click()
      await expect(editorPage.getByText(itemName)).toBeVisible()
      await expect(editorPage.getByRole('status', { name: '오프라인 저장', exact: true }).first())
        .toBeVisible()
      expect(await getChecklistItemByName(checklist.id, itemName)).toBeNull()

      await revokeAuthorityDocumentMember(multiUsers.owner, member.id)
      await editorContext.setOffline(false)

      await expect.poll(
        () => getChecklistItemByName(checklist.id, itemName),
        { timeout: 15000 },
      ).toBeNull()
      await expect.poll(
        () => readAuthorityLocalCounts(editorPage, multiUsers.editor.id, trip.id),
        { timeout: 15000 },
      ).toEqual({ resources: 0, outbox: 0 })
      expect(await attemptPlanWrite(multiUsers.editor, trip.id)).toMatch(
        /authority_trip_(write_)?forbidden/,
      )
    } finally {
      await cleanupTripsByUser(multiUsers.owner.id)
    }
  })
})

async function attemptPlanWrite(
  user: TestUser,
  tripId: string,
): Promise<string> {
  const client = createAuthenticatedTestClient(user)
  const { data: revision, error: revisionError } = await client.rpc(
    'get_trip_authority_revision',
    { p_trip_id: tripId },
  )
  if (revisionError) return revisionError.message
  const planId = randomUUID()
  const { error } = await client.rpc('apply_trip_commands', {
    p_trip_id: tripId,
    p_commands: [{
      operation_id: randomUUID(),
      entity_type: 'plan',
      entity_id: planId,
      action: 'upsert',
      payload: {
        title: '허용되지 않은 일정',
        start_datetime_local: '2026-07-23T10:00:00',
        end_datetime_local: '2026-07-23T11:00:00',
        timezone_string: 'Asia/Seoul',
      },
      created_at: new Date().toISOString(),
    }],
    p_base_revision: revision,
  })
  return error?.message ?? 'write_succeeded'
}

async function readAuthorityLocalCounts(
  page: Page,
  accountId: string,
  resourceId: string,
): Promise<{ resources: number; outbox: number }> {
  return page.evaluate(async ({ accountId: selectedAccount, resourceId: selectedResource }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('onvoy-server-authority')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const readStore = async (storeName: 'resources' | 'outbox') => {
      const transaction = database.transaction(storeName, 'readonly')
      const rows = await new Promise<Array<{ accountId?: string; resourceId?: string }>>(
        (resolve, reject) => {
          const request = transaction.objectStore(storeName).getAll()
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        },
      )
      return rows.filter(
        (row) => row.accountId === selectedAccount && row.resourceId === selectedResource,
      ).length
    }
    const [resources, outbox] = await Promise.all([
      readStore('resources'),
      readStore('outbox'),
    ])
    database.close()
    return { resources, outbox }
  }, { accountId, resourceId })
}
