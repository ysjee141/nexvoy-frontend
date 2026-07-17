import { test, expect } from './fixtures/auth';
import {
  cleanupTripsByUser,
  getChecklistItemByName,
  getOrCreateChecklist,
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
      await expect(ownerPage.getByText('TASK-050 동기화 검증', { exact: false })).toBeVisible({
        timeout: 15000,
      });
      await expect(editorPage.getByText('TASK-050 동기화 검증', { exact: false })).toBeVisible({
        timeout: 15000,
      });

      await ownerContext.setOffline(true);
      await ownerPage.getByRole('button', { name: '항목 추가' }).click();
      const itemName = `오프라인-outbox-${Date.now()}`;
      await ownerPage.getByPlaceholder('어떤 준비물인가요?').fill(itemName);
      await ownerPage.getByRole('button', { name: '추가', exact: true }).click();
      await expect(ownerPage.getByText(itemName)).toBeVisible({ timeout: 10000 });
      await expect(ownerPage.getByText('오프라인 저장')).toBeVisible();
      expect(await getChecklistItemByName(checklist.id, itemName)).toBeNull();

      await ownerContext.setOffline(false);
      await expect.poll(
        () => getChecklistItemByName(checklist.id, itemName),
        { timeout: 15000 },
      ).not.toBeNull();
      await expect(ownerPage.getByText('동기화 완료')).toBeVisible({ timeout: 15000 });
      await expect(editorPage.getByText(itemName)).toBeVisible({ timeout: 15000 });
      expect(legacyRequests).toEqual([]);
    } finally {
      await cleanupTripsByUser(multiUsers.owner.id);
    }
  });
});
