import { test, expect } from './fixtures/auth';
import {
  cleanupTripsByUser,
  getOrCreateChecklist,
  getTripMemberRole,
  seedTrip,
  seedTripMember,
} from './helpers/seed';

test.describe('Document-primary rollback integration', () => {
  test('owner/editor can edit plans while viewer stays read-only', async ({
    createAuthenticatedContextFor,
    multiUsers,
  }) => {
    await cleanupTripsByUser(multiUsers.owner.id);
    await cleanupTripsByUser(multiUsers.editor.id);
    await cleanupTripsByUser(multiUsers.viewer.id);

    const trip = await seedTrip(multiUsers.owner.id, {
      destination: 'TASK35 권한 검증',
    });
    try {
      await getOrCreateChecklist(trip.id);
      await seedTripMember(trip.id, multiUsers.editor.id, multiUsers.editor.email, 'editor');
      await seedTripMember(trip.id, multiUsers.viewer.id, multiUsers.viewer.email, 'viewer');

      await expect.poll(() => getTripMemberRole(trip.id, multiUsers.owner.id)).toBe('owner');
      await expect.poll(() => getTripMemberRole(trip.id, multiUsers.editor.id)).toBe('editor');
      await expect.poll(() => getTripMemberRole(trip.id, multiUsers.viewer.id)).toBe('viewer');

      const ownerContext = await createAuthenticatedContextFor(multiUsers.owner);
      const editorContext = await createAuthenticatedContextFor(multiUsers.editor);
      const viewerContext = await createAuthenticatedContextFor(multiUsers.viewer);
      const ownerPage = await ownerContext.newPage();
      const editorPage = await editorContext.newPage();
      const viewerPage = await viewerContext.newPage();

      await ownerPage.goto(`/trips/detail?id=${trip.id}&tab=plans&serverAuthority=0&documentPrimary=1`);
      await editorPage.goto(`/trips/detail?id=${trip.id}&tab=plans&serverAuthority=0&documentPrimary=1`);
      await viewerPage.goto(`/trips/detail?id=${trip.id}&tab=plans&serverAuthority=0&documentPrimary=1`);

      await expect(ownerPage.getByText('TASK35 권한 검증', { exact: false })).toBeVisible({
        timeout: 15000,
      });
      await expect(editorPage.getByText('TASK35 권한 검증', { exact: false })).toBeVisible({
        timeout: 15000,
      });
      await expect(viewerPage.getByText('TASK35 권한 검증', { exact: false })).toBeVisible({
        timeout: 15000,
      });

      await expect(ownerPage.getByRole('button', { name: '일정 추가' })).toBeVisible();
      await expect(editorPage.getByRole('button', { name: '일정 추가' })).toBeVisible();
      await expect(viewerPage.getByRole('button', { name: '일정 추가' })).toHaveCount(0);
    } finally {
      await cleanupTripsByUser(multiUsers.owner.id);
      await cleanupTripsByUser(multiUsers.editor.id);
      await cleanupTripsByUser(multiUsers.viewer.id);
    }
  });

  test('checklist mutation is restored from the local document after reload', async ({
    authenticatedContext,
    testUser,
  }) => {
    await cleanupTripsByUser(testUser.id);
    const trip = await seedTrip(testUser.id, {
      destination: 'TASK35 로컬 문서 검증',
    });
    try {
      await getOrCreateChecklist(trip.id);

      const page = await authenticatedContext.newPage();
      await page.goto(`/trips/detail?id=${trip.id}&tab=checklist&serverAuthority=0&documentPrimary=1`);

      const addToggleButton = page.getByRole('button', { name: '항목 추가' });
      await expect(addToggleButton).toBeVisible({ timeout: 15000 });
      await addToggleButton.click();

      const itemName = `문서우선-${Date.now()}`;
      await page.getByPlaceholder('어떤 준비물인가요?').fill(itemName);
      await expect(page.getByRole('button', { name: '추가', exact: true })).toBeEnabled({
        timeout: 5000,
      });
      await page.getByRole('button', { name: '추가', exact: true }).click();

      await expect(page.getByText(itemName)).toBeVisible({ timeout: 10000 });
      await page.reload();
      await expect(page.getByText(itemName)).toBeVisible({ timeout: 15000 });

      await page.close();
    } finally {
      await cleanupTripsByUser(testUser.id);
    }
  });
});
