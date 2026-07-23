import { test as base, type Browser, type BrowserContext } from '@playwright/test';
import { createBrowserClient } from '@supabase/ssr';
import { createTestUser, type TestUser } from '../helpers/supabase';
import { installGoogleMapsMock } from '../helpers/google-maps-mock';

const TEST_USER_EMAIL = process.env.E2E_TEST_USER_EMAIL ?? 'e2e-test@onvoy.local';
const TEST_USER_PASSWORD = process.env.E2E_TEST_USER_PASSWORD ?? 'E2eTestPassword1!';
const MULTI_USER_PASSWORD = process.env.E2E_MULTI_USER_PASSWORD ?? 'E2eTestPassword1!';

export type AuthFixtures = {
  authenticatedContext: BrowserContext;
  testUser: TestUser;
  multiUsers: {
    owner: TestUser;
    editor: TestUser;
    viewer: TestUser;
    outsider: TestUser;
    inviteMismatch: TestUser;
  };
  createAuthenticatedContextFor: (user: TestUser) => Promise<BrowserContext>;
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

export async function createAuthenticatedContext(
  browser: Browser,
  user: TestUser,
): Promise<BrowserContext> {
  const context = await browser.newContext();
  await injectSession(context, user);
  await installGoogleMapsMock(context);
  return context;
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
    const context = await createAuthenticatedContext(browser, testUser);
    await use(context);
    await context.close();
  },

  multiUsers: async ({}, use) => {
    const runId = process.env.TEST_WORKER_INDEX ?? '0';
    const owner = await createTestUser(`e2e-owner-${runId}@onvoy.local`, MULTI_USER_PASSWORD);
    const editor = await createTestUser(`e2e-editor-${runId}@onvoy.local`, MULTI_USER_PASSWORD);
    const viewer = await createTestUser(`e2e-viewer-${runId}@onvoy.local`, MULTI_USER_PASSWORD);
    const outsider = await createTestUser(`e2e-outsider-${runId}@onvoy.local`, MULTI_USER_PASSWORD);
    const inviteMismatch = await createTestUser(`e2e-mismatch-${runId}@onvoy.local`, MULTI_USER_PASSWORD);
    await use({ owner, editor, viewer, outsider, inviteMismatch });
  },

  createAuthenticatedContextFor: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async (user) => {
      const context = await createAuthenticatedContext(browser, user);
      contexts.push(context);
      return context;
    });
    await Promise.all(contexts.map((context) => context.close()));
  },
});

export { expect } from '@playwright/test';
