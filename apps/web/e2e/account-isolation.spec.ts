import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/auth'
import {
  cleanupTripsByUser,
  seedAuthorityTrip,
} from './helpers/seed'

const TEST_PASSWORD = 'E2eTestPassword1!'

test.describe('TASK-058 account-scoped browser data', () => {
  test('NEW-A06 A to B to A login never exposes another account cache or trip list', async ({
    createAuthenticatedContextFor,
    multiUsers,
  }) => {
    await cleanupTripsByUser(multiUsers.owner.id)
    await cleanupTripsByUser(multiUsers.outsider.id)
    const trip = await seedAuthorityTrip(multiUsers.owner, {
      destination: 'TASK-058 계정 A 전용',
    })

    try {
      const ownerContext = await createAuthenticatedContextFor(multiUsers.owner)
      const page = await ownerContext.newPage()
      await page.goto('/')
      await expect(page.getByText('TASK-058 계정 A 전용', { exact: true })).toBeVisible({
        timeout: 15000,
      })
      await expect.poll(
        () => countCachedTripForAccount(page, multiUsers.owner.id, trip.id),
        { timeout: 10000 },
      ).toBe(1)

      await signOut(page)
      await loginWithEmail(page, multiUsers.outsider.email)
      await expect(page.getByText('TASK-058 계정 A 전용', { exact: true })).toHaveCount(0)
      await expect(page.getByText('아직 계획된 여행이 없네요.')).toBeVisible({
        timeout: 15000,
      })
      expect(await countCachedTripForAccount(page, multiUsers.outsider.id, trip.id)).toBe(0)

      await signOut(page)
      await loginWithEmail(page, multiUsers.owner.email)
      await expect(page.getByText('TASK-058 계정 A 전용', { exact: true })).toBeVisible({
        timeout: 15000,
      })
      expect(await countCachedTripForAccount(page, multiUsers.outsider.id, trip.id)).toBe(0)
      expect(await countCachedTripForAccount(page, multiUsers.owner.id, trip.id)).toBe(1)
    } finally {
      await cleanupTripsByUser(multiUsers.owner.id)
      await cleanupTripsByUser(multiUsers.outsider.id)
    }
  })
})

async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: '로그아웃' }).click()
  await expect(page.getByRole('link', { name: '로그인', exact: true })).toBeVisible({
    timeout: 15000,
  })
}

async function loginWithEmail(page: Page, email: string): Promise<void> {
  await page.goto('/login')
  await page.getByRole('button', { name: '이메일로 계속하기' }).click()
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: '여정 시작하기' }).click()
  await expect(page.getByRole('button', { name: '로그아웃' })).toBeVisible({
    timeout: 15000,
  })
  await page.goto('/')
}

async function countCachedTripForAccount(
  page: Page,
  accountId: string,
  tripId: string,
): Promise<number> {
  return page.evaluate(async ({ selectedAccount, selectedTrip }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('onvoy-server-authority')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const transaction = database.transaction('resources', 'readonly')
    const rows = await new Promise<Array<{
      accountId?: string
      resourceId?: string
    }>>((resolve, reject) => {
      const request = transaction.objectStore('resources').getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    database.close()
    return rows.filter(
      (row) => row.accountId === selectedAccount && row.resourceId === selectedTrip,
    ).length
  }, { selectedAccount: accountId, selectedTrip: tripId })
}
