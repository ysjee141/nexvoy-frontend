import { test, expect } from './fixtures/auth';
import {
  seedTrip,
  getOrCreateChecklist,
  getChecklistItem,
  getChecklistItemByName,
  cleanupTripsByUser,
} from './helpers/seed';

test.describe('여행 생성 및 체크리스트 플로우', () => {
  // 각 테스트 전후로 해당 유저의 여행 데이터를 정리해 테스트 간 격리를 보장한다.
  test.beforeEach(async ({ testUser }) => {
    await cleanupTripsByUser(testUser.id);
  });

  test.afterEach(async ({ testUser }) => {
    await cleanupTripsByUser(testUser.id);
  });

  test('여행 생성 → 상세 페이지 진입', async ({ authenticatedContext }) => {
    const page = await authenticatedContext.newPage();
    await page.goto('/trips/new');

    // 여행지 입력: Google Maps Autocomplete가 로드되면(isLoaded) input이 활성화된다.
    const destinationInput = page.getByPlaceholder('어디로 떠나시나요?');
    await expect(destinationInput).toBeEnabled({ timeout: 15000 });
    await destinationInput.fill('도쿄');

    // Autocomplete 드롭다운이 떠 있으면 닫아 제출 버튼 클릭을 가린지 않도록 한다.
    await page.keyboard.press('Escape');

    // 시작일 / 종료일 (input[type=date]는 두 개뿐)
    await page.locator('input[type="date"]').first().fill('2026-08-01');
    await page.locator('input[type="date"]').last().fill('2026-08-05');

    // 제출
    await page.getByRole('button', { name: '여행 계획 시작하기' }).click();

    // 상세 페이지로 이동 (Next.js가 trailing slash를 추가할 수 있으므로 optional로 처리)
    await expect(page).toHaveURL(/\/trips\/detail\/?id=/, { timeout: 10000 });

    // 여행지 표시 확인 (헤더에 "도쿄 여행" 형태로 노출)
    await expect(page.getByText('도쿄')).toBeVisible();

    await page.close();
  });

  test('체크리스트 항목 추가 → 체크(완료 처리)', async ({ authenticatedContext, testUser }) => {
    // UI 생성에 의존하지 않고 독립적으로 여행을 시드해 테스트 격리를 보장한다.
    const trip = await seedTrip(testUser.id);

    const page = await authenticatedContext.newPage();
    await page.goto(`/trips/detail?id=${trip.id}&tab=checklist`);

    // 준비물 탭 영역이 로드되어 '항목 추가' 버튼이 노출될 때까지 대기 후 클릭
    const addToggleButton = page.getByRole('button', { name: '항목 추가' });
    await expect(addToggleButton).toBeVisible({ timeout: 15000 });
    await addToggleButton.click();

    // 항목명 입력 후 제출 — React controlled input은 fill 대신 type 이벤트가 필요할 수 있음
    const itemInput = page.getByPlaceholder('어떤 준비물인가요?');
    await itemInput.click();
    await itemInput.fill('여권');
    // 추가 버튼 활성화 대기 (disabled={!newItemName.trim()} 조건)
    await expect(page.getByRole('button', { name: '추가', exact: true })).toBeEnabled({ timeout: 5000 });
    await page.getByRole('button', { name: '추가', exact: true }).click();

    // 목록에 추가 확인 (DB insert + UI 반영 대기)
    await expect(page.getByText('여권')).toBeVisible({ timeout: 10000 });

    // DB 검증: 추가된 항목이 존재할 때까지 폴링 후 id 확보
    const checklist = await getOrCreateChecklist(trip.id);
    await expect
      .poll(async () => (await getChecklistItemByName(checklist.id, '여권')) !== null, {
        timeout: 10000,
      })
      .toBe(true);

    const created = await getChecklistItemByName(checklist.id, '여권');
    expect(created).not.toBeNull();
    expect(created!.is_checked).toBe(false);

    // 체크 처리: '여권' 항목 행의 체크 영역(텍스트와 체크박스가 동일 클릭 래퍼에 속함)을 클릭.
    // 항목 텍스트를 클릭하면 래퍼의 onClick(toggleItem)이 트리거된다.
    await page.getByText('여권').click();

    // DB 검증: is_checked === true 로 갱신될 때까지 폴링
    await expect
      .poll(async () => (await getChecklistItem(created!.id)).is_checked, { timeout: 10000 })
      .toBe(true);

    await page.close();
  });
});
