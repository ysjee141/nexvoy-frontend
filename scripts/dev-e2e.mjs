/**
 * E2E 테스트용 dev 서버 실행 스크립트
 *
 * 원칙: .env.local을 절대 수정하지 않는다.
 * Next.js는 이미 process.env에 설정된 값을 .env.local로 덮어쓰지 않으므로,
 * .env.test.local 값을 process.env에 먼저 주입한 뒤 next dev를 실행한다.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { spawn } from 'child_process';

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) throw new Error(`파일 없음: ${filePath}`);
  return Object.fromEntries(
    readFileSync(resolve(filePath), 'utf-8')
      .split('\n')
      .filter((line) => line.trim() && !line.startsWith('#'))
      .map((line) => {
        const idx = line.indexOf('=');
        return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
      })
      .filter(([k]) => k)
  );
}

const testEnv = loadEnvFile('.env.test.local');

// .env.test.local 값을 현재 process.env에 주입 (next dev가 상속받음)
// Next.js 우선순위: process.env > .env.local > .env
// → 이미 주입된 값은 .env.local이 덮어쓰지 않는다
Object.assign(process.env, testEnv);

const dev = spawn('node_modules/.bin/next', ['dev'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: '--dns-result-order=ipv4first',
  },
  shell: false,
});

dev.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGINT', () => dev.kill('SIGINT'));
process.on('SIGTERM', () => dev.kill('SIGTERM'));
