import { test, expect } from './fixtures/auth';
import {
  cleanupTripsByUser,
  getChecklistItemByName,
  getOrCreateChecklist,
  getPlanById,
  getPlanByTitle,
  seedAuthorityDocumentMember,
  seedAuthorityPlan,
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

  test('same-entity concurrent edits require a choice and converge on the canonical plan', async ({
    createAuthenticatedContextFor,
    multiUsers,
  }) => {
    await cleanupTripsByUser(multiUsers.owner.id);
    const trip = await seedAuthorityTrip(multiUsers.owner, {
      destination: 'TASK-056 충돌 해결 검증',
    });
    await seedAuthorityDocumentMember(trip.id, multiUsers.editor, 'editor');
    const plan = await seedAuthorityPlan(multiUsers.owner, trip, '공통 일정');

    try {
      const ownerContext = await createAuthenticatedContextFor(multiUsers.owner);
      const editorContext = await createAuthenticatedContextFor(multiUsers.editor);
      const ownerPage = await ownerContext.newPage();
      const editorPage = await editorContext.newPage();
      const detailUrl = `/trips/detail?id=${trip.id}&tab=plans&serverAuthority=1`;
      await Promise.all([ownerPage.goto(detailUrl), editorPage.goto(detailUrl)]);
      await Promise.all([
        expect(ownerPage.getByText(plan.title, { exact: true })).toBeVisible({ timeout: 15000 }),
        expect(editorPage.getByText(plan.title, { exact: true })).toBeVisible({ timeout: 15000 }),
      ]);

      for (const [page, nextTitle] of [
        [ownerPage, '소유자 동시 수정'],
        [editorPage, '편집자 동시 수정'],
      ] as const) {
        await page.getByRole('button', { name: `일정 수정: ${plan.title}`, exact: true }).click();
        await page.getByPlaceholder('예: 근사한 저녁 식사, 박물관 투어').fill(nextTitle);
      }

      await Promise.all([ownerContext.setOffline(true), editorContext.setOffline(true)]);
      await Promise.all([
        ownerPage.getByRole('button', { name: '수정 완료', exact: true }).click(),
        editorPage.getByRole('button', { name: '수정 완료', exact: true }).click(),
      ]);
      await Promise.all([
        expect(ownerPage.getByText('소유자 동시 수정', { exact: true })).toBeVisible(),
        expect(editorPage.getByText('편집자 동시 수정', { exact: true })).toBeVisible(),
      ]);
      await Promise.all([ownerContext.setOffline(false), editorContext.setOffline(false)]);

      await expect.poll(async () => (
        await ownerPage.getByRole('button', { name: /해결 방법 선택/ }).count() +
        await editorPage.getByRole('button', { name: /해결 방법 선택/ }).count()
      ), { timeout: 15000 }).toBe(1);

      const conflictPage = await ownerPage.getByRole('button', { name: /해결 방법 선택/ }).count()
        ? ownerPage
        : editorPage;
      await conflictPage.getByRole('button', { name: /해결 방법 선택/ }).click();
      await expect(conflictPage.getByRole('heading', { name: '변경 사항을 선택해 주세요' })).toBeVisible();
      await conflictPage.getByRole('button', { name: '서버 최신 내용 사용', exact: true }).click();

      await expect.poll(async () => (await getPlanById(plan.id))?.title, {
        timeout: 15000,
      }).toMatch(/^(소유자|편집자) 동시 수정$/);
      const canonicalTitle = (await getPlanById(plan.id))?.title;
      if (!canonicalTitle) throw new Error('Canonical plan title was not materialized.');
      await expect(ownerPage.getByText(canonicalTitle, { exact: true })).toBeVisible({ timeout: 15000 });
      await expect(editorPage.getByText(canonicalTitle, { exact: true })).toBeVisible({ timeout: 15000 });
    } finally {
      await cleanupTripsByUser(multiUsers.owner.id);
    }
  });

  test('NEW-A09 retrying the local conflict rebases once and converges', async ({
    createAuthenticatedContextFor,
    multiUsers,
  }) => {
    await cleanupTripsByUser(multiUsers.owner.id);
    const trip = await seedAuthorityTrip(multiUsers.owner, {
      destination: 'TASK-058 로컬 충돌 재적용',
    });
    await seedAuthorityDocumentMember(trip.id, multiUsers.editor, 'editor');
    const plan = await seedAuthorityPlan(multiUsers.owner, trip, '재적용 공통 일정');

    try {
      const ownerContext = await createAuthenticatedContextFor(multiUsers.owner);
      const editorContext = await createAuthenticatedContextFor(multiUsers.editor);
      const ownerPage = await ownerContext.newPage();
      const editorPage = await editorContext.newPage();
      const detailUrl = `/trips/detail?id=${trip.id}&tab=plans&serverAuthority=1`;
      await Promise.all([ownerPage.goto(detailUrl), editorPage.goto(detailUrl)]);
      await Promise.all([
        expect(ownerPage.getByText(plan.title, { exact: true })).toBeVisible({ timeout: 15000 }),
        expect(editorPage.getByText(plan.title, { exact: true })).toBeVisible({ timeout: 15000 }),
      ]);

      const ownerTitle = '소유자 로컬 재적용';
      const editorTitle = '편집자 로컬 재적용';
      for (const [page, nextTitle] of [
        [ownerPage, ownerTitle],
        [editorPage, editorTitle],
      ] as const) {
        await page.getByRole('button', { name: `일정 수정: ${plan.title}`, exact: true }).click();
        await page.getByPlaceholder('예: 근사한 저녁 식사, 박물관 투어').fill(nextTitle);
      }

      await Promise.all([ownerContext.setOffline(true), editorContext.setOffline(true)]);
      await Promise.all([
        ownerPage.getByRole('button', { name: '수정 완료', exact: true }).click(),
        editorPage.getByRole('button', { name: '수정 완료', exact: true }).click(),
      ]);
      await Promise.all([ownerContext.setOffline(false), editorContext.setOffline(false)]);

      await expect.poll(async () => (
        await ownerPage.getByRole('button', { name: /해결 방법 선택/ }).count() +
        await editorPage.getByRole('button', { name: /해결 방법 선택/ }).count()
      ), { timeout: 15000 }).toBe(1);

      const ownerHasConflict = await ownerPage.getByRole('button', { name: /해결 방법 선택/ }).count() > 0;
      const conflictPage = ownerHasConflict ? ownerPage : editorPage;
      const retriedTitle = ownerHasConflict ? ownerTitle : editorTitle;
      await conflictPage.getByRole('button', { name: /해결 방법 선택/ }).click();
      await conflictPage.getByRole('button', { name: '이 기기 변경 다시 적용', exact: true }).click();

      await expect.poll(async () => await getPlanById(plan.id), {
        timeout: 15000,
      }).toMatchObject({ id: plan.id, title: retriedTitle, version: 3 });
      await expect(ownerPage.getByText(retriedTitle, { exact: true })).toBeVisible({ timeout: 15000 });
      await expect(editorPage.getByText(retriedTitle, { exact: true })).toBeVisible({ timeout: 15000 });
    } finally {
      await cleanupTripsByUser(multiUsers.owner.id);
    }
  });
});
