import { test, expect } from './fixtures/auth'
import {
  cleanupTemplatesByUser,
  cleanupTripsByUser,
  getChecklistItemBySourceTemplate,
  getOrCreateChecklist,
  getTemplateByTitle,
  getTemplateItems,
  seedAuthorityTrip,
} from './helpers/seed'

test.describe('TASK-058 template authority product flow', () => {
  test('NEW-A07 template create, item replacement, and trip application converge', async ({
    authenticatedContext,
    testUser,
  }) => {
    await cleanupTemplatesByUser(testUser.id)
    await cleanupTripsByUser(testUser.id)
    const trip = await seedAuthorityTrip(testUser, {
      destination: 'TASK-058 템플릿 적용',
    })
    const checklist = await getOrCreateChecklist(trip.id)
    const initialTitle = `TASK-058 템플릿 ${Date.now()}`
    const updatedTitle = `${initialTitle} 수정`
    const firstItem = '여권'
    const replacedItem = '충전기'
    const addedItem = '상비약'

    try {
      const page = await authenticatedContext.newPage()
      await page.goto('/templates')
      await expect(page.getByRole('heading', { name: '내 체크리스트 템플릿' })).toBeVisible({
        timeout: 15000,
      })
      await page.getByRole('button', { name: '새 템플릿 만들기' }).click()
      await page.getByPlaceholder(/여름 바다 여행 필수템/).fill(initialTitle)
      await page.getByPlaceholder('1번째 준비물').fill(firstItem)
      await page.getByRole('button', { name: '템플릿 저장할게요' }).click()

      await expect(page.getByText(initialTitle, { exact: true })).toBeVisible({ timeout: 15000 })
      await expect.poll(
        () => getTemplateByTitle(testUser.id, initialTitle),
        { timeout: 10000 },
      ).not.toBeNull()
      const createdTemplate = await getTemplateByTitle(testUser.id, initialTitle)
      if (!createdTemplate) throw new Error('Created template was not materialized.')

      await page.getByRole('button', { name: new RegExp(initialTitle) }).click()
      await expect(page.getByRole('heading', { name: '템플릿 수정하기' })).toBeVisible()
      const editModal = page.getByRole('heading', { name: '템플릿 수정하기' }).locator('..').locator('..')
      await editModal.getByPlaceholder(/여름 바다 여행 필수템/).fill(updatedTitle)
      await editModal.getByPlaceholder('1번째 준비물').fill(replacedItem)
      await editModal.getByRole('button', { name: '준비물 항목 추가하기' }).click()
      await editModal.getByPlaceholder('2번째 준비물').fill(addedItem)
      await editModal.getByRole('button', { name: '변경 내용 저장할게요' }).click()

      await expect(
        page.getByRole('heading', { name: updatedTitle, exact: true }),
      ).toBeVisible({ timeout: 15000 })
      await expect.poll(
        async () => (await getTemplateItems(createdTemplate.id)).map((item) => item.item_name),
        { timeout: 10000 },
      ).toEqual([replacedItem, addedItem])

      await page.goto(`/trips/detail?id=${trip.id}&tab=checklist&serverAuthority=1`)
      await expect(page.getByRole('heading', {
        name: 'TASK-058 템플릿 적용 여행',
        exact: true,
      })).toBeVisible({ timeout: 15000 })
      await page.getByRole('button', { name: '템플릿 불러오기' }).filter({ visible: true }).click()
      await expect(page.getByRole('heading', { name: '템플릿 불러오기' })).toBeVisible()
      const templateRow = page.getByText(updatedTitle, { exact: true }).locator('..').locator('..')
      await templateRow.getByRole('button', { name: '가져오기' }).click()

      await expect(page.getByText(replacedItem, { exact: true })).toBeVisible({ timeout: 15000 })
      await expect(page.getByText(addedItem, { exact: true })).toBeVisible({ timeout: 15000 })
      await expect.poll(
        async () => (
          await getChecklistItemBySourceTemplate(checklist.id, updatedTitle)
        ).map((item) => item.item_name).sort(),
        { timeout: 10000 },
      ).toEqual([addedItem, replacedItem].sort())
    } finally {
      await cleanupTemplatesByUser(testUser.id)
      await cleanupTripsByUser(testUser.id)
    }
  })
})
