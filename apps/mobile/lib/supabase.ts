/**
 * Supabase 클라이언트 (nexvoy-app)
 *
 * - @nexvoy/core 는 client 를 주입받는 패턴(ADR-010)이므로, 앱은 여기서 client 를 생성하고
 *   core 쿼리 함수 호출 시 이 인스턴스를 첫 인자로 넘긴다.
 * - 세션 저장소: expo-secure-store (민감 토큰을 OS 보안 저장소에 암호화 보관).
 * - detectSessionInUrl: false — RN 은 URL 기반 세션 감지를 사용하지 않음(딥링크는 별도 처리).
 */
import 'react-native-get-random-values' // crypto.getRandomValues polyfill (PKCE 필수)
import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // 셋업 단계에서 .env.local 미설정 시 명확한 안내. 운영 빌드에서는 값이 주입되어야 함.
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY 가 설정되지 않았습니다. apps/mobile/.env.local 을 확인하세요.'
  )
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
