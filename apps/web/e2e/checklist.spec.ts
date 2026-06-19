import { test, expect } from './fixtures/auth'
import {
  seedTrip,
  getOrCreateChecklist,
  getChecklistItemByName,
  getChecklistItem,
  cleanupTripsByUser,
} from './helpers/seed'

test.describe('체크리스트 핵심 플로우', () => {
  test.beforeEach(async ({ testUser }) => {
    await cleanupTripsByUser(testUser.id)
  })

  test.afterEach(async ({ testUser }) => {
    await cleanupTripsByUser(testUser.id)
  })

  test('/trips/checklist — trips/detail 체크리스트 탭으로 리다이렉트', async ({
    authenticatedContext,
    testUser,
  }) => {
    const trip = await seedTrip(testUser.id)
    await getOrCreateChecklist(trip.id)

    const page = await authenticatedContext.newPage()
    await page.goto(`/trips/checklist?id=${trip.id}`)

    // /trips/detail?id=...&tab=checklist 로 리다이렉트
    await expect(page).toHaveURL(/\/trips\/detail.*tab=checklist/, { timeout: 10000 })

    // 준비물 탭 UI 로드 확인
    const addToggleButton = page.getByRole('button', { name: '항목 추가' })
    await expect(addToggleButton).toBeVisible({ timeout: 15000 })

    await page.close()
  })

  test('trips/detail 체크리스트 탭 — 항목 추가 및 체크', async ({
    authenticatedContext,
    testUser,
  }) => {
    const trip = await seedTrip(testUser.id)
    await getOrCreateChecklist(trip.id)

    const page = await authenticatedContext.newPage()
    await page.goto(`/trips/detail?id=${trip.id}&tab=checklist`)

    // 준비물 탭 영역 로드 대기
    const addToggleButton = page.getByRole('button', { name: '항목 추가' })
    await expect(addToggleButton).toBeVisible({ timeout: 15000 })
    await addToggleButton.click()

    // 항목명 입력
    const itemInput = page.getByPlaceholder('어떤 준비물인가요?')
    await itemInput.click()
    await itemInput.fill('선크림')
    await expect(page.getByRole('button', { name: '추가', exact: true })).toBeEnabled({
      timeout: 5000,
    })
    await page.getByRole('button', { name: '추가', exact: true }).click()

    // UI 확인
    await expect(page.getByText('선크림')).toBeVisible({ timeout: 10000 })

    // DB 검증
    const checklist = await getOrCreateChecklist(trip.id)
    await expect
      .poll(async () => (await getChecklistItemByName(checklist.id, '선크림')) !== null, {
        timeout: 10000,
      })
      .toBe(true)

    const created = await getChecklistItemByName(checklist.id, '선크림')
    expect(created).not.toBeNull()
    expect(created!.is_checked).toBe(false)

    // 체크 처리
    await page.getByText('선크림').click()

    await expect
      .poll(async () => (await getChecklistItem(created!.id)).is_checked, { timeout: 10000 })
      .toBe(true)

    await page.close()
  })

  test('체크리스트 비인증 접근 — 로그인 리다이렉트', async ({ page }) => {
    await page.goto('/trips/checklist?id=non-existent')
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 })
  })
})
