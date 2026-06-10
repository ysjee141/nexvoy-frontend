import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

// .env.test.local을 playwright 프로세스 및 테스트 코드에 주입
config({ path: '.env.test.local' });

export default defineConfig({
  testDir: './e2e',
  globalTeardown: './e2e/global-teardown.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    // E2E 전용 dev 서버: .env.test.local을 process.env로 주입 후 next dev 실행
    // .env.local은 절대 수정하지 않음 (rules.md §5)
    command: 'pnpm dev:e2e',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
