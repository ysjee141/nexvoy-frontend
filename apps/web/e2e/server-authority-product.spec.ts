import { test, expect } from './fixtures/auth';
import {
  cleanupTripsByUser,
  getChecklistItemByName,
  getOrCreateChecklist,
  getPlanByTitle,
  seedAuthorityDocumentMember,
  seedAuthorityTrip,
} from './helpers/seed';

const LEGACY_PRODUCT_ENDPOINTS = [
  'get_my_active_document_key',
  'document_updates',
  'document_snapshots',
  'signaling:',
];

test.describe('TASK-050 Web server-authority product integration', () => {
  test('offline outbox reconnects and an editor receives the canonical change', async ({
    createAuthenticatedContextFor,
    multiUsers,
  }) => {
    await cleanupTripsByUser(multiUsers.owner.id);
    const trip = await seedAuthorityTrip(multiUsers.owner, {
      destination: 'TASK-050 동기화 검증',
    });
    await seedAuthorityDocumentMember(trip.id, multiUsers.editor, 'editor');
    const checklist = await getOrCreateChecklist(trip.id);

    try {
      const ownerContext = await createAuthenticatedContextFor(multiUsers.owner);
      const editorContext = await createAuthenticatedContextFor(multiUsers.editor);
      const ownerPage = await ownerContext.newPage();
      const editorPage = await editorContext.newPage();
      const legacyRequests: string[] = [];
      for (const page of [ownerPage, editorPage]) {
        page.on('request', (request) => {
          if (LEGACY_PRODUCT_ENDPOINTS.some((part) => request.url().includes(part))) {
            legacyRequests.push(request.url());
          }
        });
      }

      const detailUrl = `/trips/detail?id=${trip.id}&tab=checklist&serverAuthority=1`;
      await ownerPage.goto(detailUrl);
      await editorPage.goto(detailUrl);
      await expect(ownerPage.getByRole('heading', { name: 'TASK-050 동기화 검증 여행', exact: true })).toBeVisible({
        timeout: 15000,
      });
      await expect(editorPage.getByRole('heading', { name: 'TASK-050 동기화 검증 여행', exact: true })).toBeVisible({
        timeout: 15000,
      });

      await ownerContext.setOffline(true);
      await ownerPage.getByRole('button', { name: '항목 추가' }).click();
      const itemName = `오프라인-outbox-${Date.now()}`;
      await ownerPage.getByPlaceholder('어떤 준비물인가요?').fill(itemName);
      await ownerPage.getByRole('button', { name: '추가', exact: true }).click();
      await expect(ownerPage.getByText(itemName)).toBeVisible({ timeout: 10000 });
      await expect(ownerPage.getByRole('status', { name: '오프라인 저장', exact: true }).first()).toBeVisible();
      expect(await getChecklistItemByName(checklist.id, itemName)).toBeNull();

      await ownerContext.setOffline(false);
      await expect.poll(
        () => getChecklistItemByName(checklist.id, itemName),
        { timeout: 15000 },
      ).not.toBeNull();
      await expect(ownerPage.getByRole('status', { name: '동기화 완료', exact: true }).first()).toBeVisible({ timeout: 15000 });
      await expect(editorPage.getByText(itemName)).toBeVisible({ timeout: 15000 });
      expect(legacyRequests).toEqual([]);
    } finally {
      await cleanupTripsByUser(multiUsers.owner.id);
    }
  });

  test('plan creation keeps the trip root intact and reaches the canonical server', async ({
    authenticatedContext,
    testUser,
  }) => {
    await cleanupTripsByUser(testUser.id);
    const trip = await seedAuthorityTrip(testUser, {
      destination: 'TASK-050 일정 명령 검증',
    });

    try {
      const page = await authenticatedContext.newPage();
      await page.goto(`/trips/detail?id=${trip.id}&tab=plans&serverAuthority=1`);
      await expect(page.getByRole('heading', { name: 'TASK-050 일정 명령 검증 여행', exact: true })).toBeVisible({
        timeout: 15000,
      });

      await page.getByRole('button', { name: '일정 추가' }).click();
      const placeName = `명령 분류 장소 ${Date.now()}`;
      await page.getByPlaceholder(/레스토랑|장소 이름/).fill(placeName);
      await page.getByRole('button', { name: /계속하기/ }).click();

      const planTitle = `plan-command-${Date.now()}`;
      await page.getByPlaceholder('예: 근사한 저녁 식사, 박물관 투어').fill(planTitle);
      await page.locator('input[type="date"]').fill(trip.start_date);
      await page.locator('input[type="time"]').fill('10:00');
      await page.getByRole('button', { name: '일정 추가하기' }).click();

      await expect(page.getByText(planTitle)).toBeVisible({ timeout: 10000 });
      await expect.poll(
        () => getPlanByTitle(trip.id, planTitle),
        { timeout: 15000 },
      ).not.toBeNull();
      await expect(page.getByRole('heading', { name: 'TASK-050 일정 명령 검증 여행', exact: true })).toBeVisible();
      await expect(page.getByRole('status', { name: '동기화 완료', exact: true }).first()).toBeVisible({ timeout: 15000 });
      await page.close();
    } finally {
      await cleanupTripsByUser(testUser.id);
    }
  });
});
