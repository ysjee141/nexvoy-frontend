import { createClient } from '@supabase/supabase-js';

function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`환경변수 누락: ${key}`);
  return val;
}

export interface TestUser {
  id: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}

/**
 * 테스트 전용 유저를 생성하고 세션 토큰을 반환한다.
 * 실제 고객/임직원 정보를 사용하지 말 것.
 */
export async function createTestUser(email: string, password: string): Promise<TestUser> {
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  // 1. 유저 생성 또는 비밀번호 업데이트 (admin REST API)
  const createRes = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });

  const createBody = await createRes.json();

  let userId: string;
  if (createRes.ok) {
    userId = createBody.id;
  } else if (createBody.msg?.includes('already') || createBody.code === 'email_exists' || createBody.code === '23505') {
    // 이미 존재하면 목록에서 찾아 비밀번호 업데이트
    const listRes = await fetch(`${url}/auth/v1/admin/users?per_page=1000`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    const { users } = await listRes.json();
    const found = (users as any[]).find((u) => u.email === email);
    if (!found) throw new Error(`테스트 유저를 찾을 수 없음: ${email}`);
    userId = found.id;

    await fetch(`${url}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password, email_confirm: true }),
    });
  } else {
    throw new Error(`테스트 유저 생성 실패: ${JSON.stringify(createBody)}`);
  }

  // 2. 세션 발급 (anon key로 signInWithPassword)
  const signInRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const session = await signInRes.json();
  if (!session.access_token) {
    throw new Error(`세션 발급 실패: ${JSON.stringify(session)}`);
  }

  return {
    id: userId,
    email,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  };
}

/**
 * 테스트 유저와 연관된 모든 데이터를 삭제한다 (teardown).
 */
export async function deleteTestUser(email: string): Promise<void> {
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  const listRes = await fetch(`${url}/auth/v1/admin/users?per_page=1000`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const { users } = await listRes.json();
  const found = (users as any[]).find((u) => u.email === email);
  if (!found) return;

  await fetch(`${url}/auth/v1/admin/users/${found.id}`, {
    method: 'DELETE',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
}
