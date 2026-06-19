import { test as base, type BrowserContext } from '@playwright/test';
import { createBrowserClient } from '@supabase/ssr';
import { createTestUser, type TestUser } from '../helpers/supabase';
import { installGoogleMapsMock } from '../helpers/google-maps-mock';

const TEST_USER_EMAIL = process.env.E2E_TEST_USER_EMAIL ?? 'e2e-test@onvoy.local';
const TEST_USER_PASSWORD = process.env.E2E_TEST_USER_PASSWORD ?? 'E2eTestPassword1!';

export type AuthFixtures = {
  authenticatedContext: BrowserContext;
  testUser: TestUser;
};

/**
 * @supabase/ssr의 createBrowserClient를 사용해 실제 쿠키 이름과 인코딩 방식을
 * 그대로 재현한다. 쿠키 이름은 Supabase URL의 호스트명 첫 세그먼트에서 결정되므로
 * 직접 계산하지 않고 SDK에 위임한다.
 */
async function injectSession(context: BrowserContext, user: TestUser) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const baseURL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const domain = new URL(baseURL).hostname;

  const collectedCookies: Array<{ name: string; value: string }> = [];

  const client = createBrowserClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => collectedCookies,
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => {
          const idx = collectedCookies.findIndex((c) => c.name === name);
          if (idx >= 0) collectedCookies[idx].value = value;
          else collectedCookies.push({ name, value });
        });
      },
    },
  });

  // SDK가 세션을 설정하면서 올바른 쿠키 이름/인코딩으로 collectedCookies에 저장한다
  await client.auth.setSession({
    access_token: user.accessToken,
    refresh_token: user.refreshToken,
  });

  await context.addCookies(
    collectedCookies.map(({ name, value }) => ({
      name,
      value,
      domain,
      path: '/',
      httpOnly: false,
      sameSite: 'Lax' as const,
    }))
  );
}

export const test = base.extend<AuthFixtures>({
  testUser: async ({}, use) => {
    const user = await createTestUser(TEST_USER_EMAIL, TEST_USER_PASSWORD);
    await use(user);
    // 유저 삭제 대신 데이터만 cleanup: deleteTestUser는 병렬 실행 시
    // 다른 테스트의 createTestUser와 충돌하고 profiles cascade 삭제로
    // seed FK 오류를 유발한다.
  },

  authenticatedContext: async ({ browser, testUser }, use) => {
    const context = await browser.newContext();
    await injectSession(context, testUser);
    // Google Maps JS API를 결정적 스텁으로 대체 → 실제 외부 호출/쿼터/비결정성 제거.
    // 컨텍스트 레벨에 설치해 이 컨텍스트의 모든 page에 일괄 적용한다.
    await installGoogleMapsMock(context);
    await use(context);
    await context.close();
  },
});

export { expect } from '@playwright/test';
