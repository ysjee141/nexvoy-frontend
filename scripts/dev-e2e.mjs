/**
 * E2E 테스트용 dev 서버 실행 스크립트
 *
 * 원칙: .env.local을 절대 수정하지 않는다.
 * NODE_ENV=test 설정 → Next.js가 .env.test.local을 .env.local보다 높은 우선순위로
 * 자동 로드하므로 NEXT_PUBLIC_* 변수도 올바르게 테스트용 값으로 번들링된다.
 * 참고: @next/env의 loadEnvConfig는 NODE_ENV=test일 때 .env.test.local만 로드하고
 * .env.local은 로드하지 않는다.
 */
import { spawn } from 'child_process';

const dev = spawn('node_modules/.bin/next', ['dev'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
    NODE_OPTIONS: '--dns-result-order=ipv4first',
  },
  shell: false,
});

dev.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => dev.kill('SIGINT'));
process.on('SIGTERM', () => dev.kill('SIGTERM'));
