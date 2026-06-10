import { test, expect } from './fixtures/auth';
import {
  seedTrip,
  getOrCreateChecklist,
  seedChecklistItem,
  cleanupTripsByUser,
  seedTemplate,
  seedTemplateItem,
  getTemplateByTitle,
  getTemplateItemByName,
  getChecklistItemBySourceTemplate,
  cleanupTemplatesByUser,
} from './helpers/seed';

test.describe('템플릿 생성 → 아이템 추가 → 여행 적용 플로우', () => {
  // 각 테스트 전후로 해당 유저의 템플릿/여행 데이터를 정리해 테스트 간 격리를 보장한다.
  test.beforeEach(async ({ testUser }) => {
    await cleanupTemplatesByUser(testUser.id);
    await cleanupTripsByUser(testUser.id);
  });

  test.afterEach(async ({ testUser }) => {
    await cleanupTemplatesByUser(testUser.id);
    await cleanupTripsByUser(testUser.id);
  });

  test('템플릿 생성 → 목록 노출 및 DB 검증', async ({ authenticatedContext, testUser }) => {
    const page = await authenticatedContext.newPage();
    await page.goto('/templates');

    // "새 템플릿 만들기" 버튼 클릭 → 전역 생성 모달 오픈
    await page.getByRole('button', { name: '새 템플릿 만들기' }).click();

    // 모달 폼 필드가 노출될 때까지 대기
    const titleInput = page.getByPlaceholder('예: 여름 바다 여행 필수템 🏖️');
    await expect(titleInput).toBeVisible({ timeout: 15000 });

    // 제목 / 첫 번째 아이템 입력
    await titleInput.fill('E2E 테스트 템플릿');
    await page.getByPlaceholder('1번째 준비물').fill('선글라스');

    // 저장
    await page.getByRole('button', { name: '템플릿 저장할게요' }).click();

    // 모달 닫힘 확인
    await expect(titleInput).toBeHidden({ timeout: 10000 });

    // 목록에 제목 노출
    await expect(page.getByText('E2E 테스트 템플릿')).toBeVisible({ timeout: 10000 });

    // DB 검증 1: checklist_templates에 title='E2E 테스트 템플릿'이 존재할 때까지 폴링
    await expect
      .poll(async () => (await getTemplateByTitle(testUser.id, 'E2E 테스트 템플릿')) !== null, {
        timeout: 10000,
      })
      .toBe(true);

    // DB 검증 2: 해당 템플릿에 '선글라스' 항목이 함께 저장되었는지 확인
    const created = await getTemplateByTitle(testUser.id, 'E2E 테스트 템플릿');
    expect(created).not.toBeNull();
    expect(await getTemplateItemByName(created!.id, '선글라스')).not.toBeNull();

    await page.close();
  });

  test('기존 템플릿 카드 클릭 → 아이템 추가 → DB 검증', async ({
    authenticatedContext,
    testUser,
  }) => {
    // 편집 대상 템플릿과 기존 항목 1개를 사전 시드한다.
    const template = await seedTemplate(testUser.id, { title: 'E2E 편집 템플릿' });
    await seedTemplateItem(template.id, '기존항목');

    const page = await authenticatedContext.newPage();
    await page.goto('/templates');

    // 목록 로드 대기: 시드한 템플릿 카드가 노출될 때까지 대기 후 클릭하여 편집 모달 오픈
    const templateCard = page.getByText('E2E 편집 템플릿');
    await expect(templateCard).toBeVisible({ timeout: 15000 });
    await templateCard.click();

    // 편집 모달 로드 대기: 기존 항목이 입력 필드(1번째 준비물)에 채워질 때까지 대기
    const firstItemInput = page.getByPlaceholder('1번째 준비물');
    await expect(firstItemInput).toHaveValue('기존항목', { timeout: 10000 });

    // "준비물 항목 추가하기" 버튼 클릭 → 새 행 추가
    await page.getByRole('button', { name: '준비물 항목 추가하기' }).click();

    // 새 행(2번째 준비물)에 입력
    const secondItemInput = page.getByPlaceholder('2번째 준비물');
    await expect(secondItemInput).toBeVisible({ timeout: 10000 });
    await secondItemInput.fill('추가항목');

    // 저장 (편집 모달 제출 버튼: "변경 내용 저장할게요")
    await page.getByRole('button', { name: /저장/ }).click();

    // 모달 닫힘 확인
    await expect(firstItemInput).toBeHidden({ timeout: 10000 });

    // DB 검증: '추가항목'이 해당 템플릿에 존재할 때까지 폴링
    await expect
      .poll(async () => (await getTemplateItemByName(template.id, '추가항목')) !== null, {
        timeout: 10000,
      })
      .toBe(true);

    await page.close();
  });

  test('템플릿을 여행 체크리스트에 적용', async ({ authenticatedContext, testUser }) => {
    // 여행 + 체크리스트 시드. 더미 항목 1개를 미리 넣어 "템플릿 불러오기" 버튼 영역의
    // 게이팅(목록 비어있을 때 UI 분기) 영향을 회피한다.
    const trip = await seedTrip(testUser.id);
    const checklist = await getOrCreateChecklist(trip.id);
    await seedChecklistItem(checklist.id, '기존항목');

    // 적용할 템플릿 + 항목 시드
    const template = await seedTemplate(testUser.id, { title: '적용할 템플릿' });
    await seedTemplateItem(template.id, '여권');

    const page = await authenticatedContext.newPage();
    await page.goto(`/trips/detail?id=${trip.id}&tab=checklist`);

    // "템플릿 불러오기" 버튼 노출 대기 후 클릭
    const loadTemplateButton = page.getByRole('button', { name: '템플릿 불러오기' });
    await expect(loadTemplateButton).toBeVisible({ timeout: 15000 });
    await loadTemplateButton.click();

    // 적용 모달에서 '적용할 템플릿' 행의 "가져오기" 버튼 클릭
    const templateRowName = page.getByText('적용할 템플릿');
    await expect(templateRowName).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: '가져오기' }).first().click();

    // 체크리스트에 '여권' 노출
    await expect(page.getByText('여권')).toBeVisible({ timeout: 10000 });

    // DB 검증: source_template_name='적용할 템플릿'인 항목이 존재할 때까지 폴링
    await expect
      .poll(
        async () =>
          (await getChecklistItemBySourceTemplate(checklist.id, '적용할 템플릿')).length > 0,
        { timeout: 10000 }
      )
      .toBe(true);

    const applied = await getChecklistItemBySourceTemplate(checklist.id, '적용할 템플릿');
    expect(applied.some((i) => i.item_name === '여권')).toBe(true);

    await page.close();
  });
});
