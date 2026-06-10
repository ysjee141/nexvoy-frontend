import { test, expect } from './fixtures/auth';

test.describe('스모크: 홈 페이지', () => {
  test('비인증 사용자 — 랜딩 페이지 렌더링', async ({ page }) => {
    await page.goto('/');

    // 비로그인 랜딩 페이지 핵심 요소 확인 (동일 텍스트 복수 존재 → first() 사용)
    await expect(page.getByRole('link', { name: '지금 바로 시작하기' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: '로그인하기' })).toBeVisible();
  });

  test('인증된 사용자 — 홈 렌더링 및 주요 UI 확인', async ({ authenticatedContext }) => {
    const page = await authenticatedContext.newPage();
    await page.goto('/');

    // 인증된 홈: 환영 메시지 ("님! 👋" 포함)
    await expect(page.getByText('님! 👋')).toBeVisible({ timeout: 10000 });

    // 새 여행 만들기 버튼
    await expect(page.getByRole('button', { name: /새 여행 만들기/ })).toBeVisible();

    // 비로그인 랜딩 CTA가 보이지 않아야 함
    await expect(page.getByRole('link', { name: '지금 바로 시작하기' }).first()).not.toBeVisible();

    await page.close();
  });

  test('인증된 사용자 — 보호 경로 접근 가능', async ({ authenticatedContext }) => {
    const page = await authenticatedContext.newPage();

    await page.goto('/trips/new');

    // /login으로 리다이렉트되지 않아야 함
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });

    await page.close();
  });

  test('비인증 사용자 — 보호 경로 접근 시 로그인 리다이렉트', async ({ page }) => {
    await page.goto('/trips/new');

    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
  });
});
