import { createClient } from '@supabase/supabase-js';

// handle_new_user trigger가 비동기로 profiles row를 생성하므로
// CI 환경에서 트리거가 느릴 수 있어 15초 폴링 후 직접 upsert fallback.
async function ensureProfile(userId: string, email: string, url: string, serviceKey: string): Promise<void> {
  const client = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const { data } = await client.from('profiles').select('id').eq('id', userId).maybeSingle();
    if (data?.id) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  // 트리거가 실행되지 않은 경우 service role로 직접 생성
  await client.from('profiles').upsert({ id: userId, email }, { onConflict: 'id' });
}

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

type PasswordSession = {
  access_token?: string;
  refresh_token?: string;
  user?: {
    id?: string;
  };
};

function isAlreadyRegisteredError(error: { message?: string; code?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? '';
  return (
    message.includes('already') ||
    message.includes('registered') ||
    error?.code === 'email_exists' ||
    error?.code === '23505'
  );
}

async function findExistingUserId(
  adminClient: any,
  email: string
): Promise<string> {
  const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (error) {
    throw new Error(`테스트 유저 목록 조회 실패: ${error.message}`);
  }

  const found = (data.users as Array<{ id: string; email?: string }>).find((u) => u.email === email);
  if (!found) throw new Error(`테스트 유저를 찾을 수 없음: ${email}`);

  return found.id;
}

/**
 * 테스트 전용 유저를 생성하고 세션 토큰을 반환한다.
 * 실제 고객/임직원 정보를 사용하지 말 것.
 */
export async function createTestUser(email: string, password: string): Promise<TestUser> {
  const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
  const adminClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. 유저 생성 또는 비밀번호 업데이트 (admin API)
  const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  let userId: string;
  let passwordSession: PasswordSession | null = null;

  if (createData.user) {
    userId = createData.user.id;
  } else if (isAlreadyRegisteredError(createError)) {
    // CI Supabase projects can fail admin listUsers with "Database error finding users".
    // Existing e2e users normally keep the same password, so reuse password auth first.
    const existingSignInRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const existingSession = await existingSignInRes.json();

    if (existingSession.access_token && existingSession.user?.id) {
      passwordSession = existingSession;
      userId = existingSession.user.id;
    } else {
      userId = await findExistingUserId(adminClient, email);
      const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });

      if (updateError) {
        throw new Error(`테스트 유저 비밀번호 업데이트 실패: ${updateError.message}`);
      }
    }
  } else {
    throw new Error(`테스트 유저 생성 실패: ${createError?.message ?? 'Unknown error'}`);
  }

  // 1-b. profiles row 보장 (trigger 대기 → 타임아웃 시 직접 upsert)
  await ensureProfile(userId, email, url, serviceKey);

  // 2. 세션 발급 (anon key로 signInWithPassword)
  const session = passwordSession ?? await (async () => {
    const signInRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return signInRes.json();
  })();
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
  const adminClient = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const userId = await findExistingUserId(adminClient, email).catch(() => null);
  if (!userId) return;

  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) throw new Error(`테스트 유저 삭제 실패: ${error.message}`);
}
