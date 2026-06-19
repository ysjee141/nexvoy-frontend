/**
 * 공유 여정 읽기 전용 화면 (nexvoy-app)
 *
 * 라우트: `/share/[id]` — `id` 는 share_token.
 *
 * 흐름:
 *  1. trip_shares 를 share_token 으로 조회 (password_hash 등 민감 컬럼 제외).
 *  2. 만료 확인.
 *  3. share_type === 'public' → 바로 여정 정보 표시.
 *     share_type === 'password' → 비밀번호 입력 UI 표시.
 *  4. 비밀번호 검증은 웹 API(/api/share/verify)에서 서버 사이드로만 수행한다.
 *     (password_hash 는 절대 클라이언트로 내려보내지 않음 — 웹과 동일 정책)
 *
 * 읽기 전용 화면이며, 수정 액션은 제공하지 않는다. 하단의 "내 앱에서 참여하기"는
 * 동일 토큰이 초대 토큰이 아니므로 join 으로 직접 연결하지 않고 홈으로 안내한다.
 *
 * 환경변수: EXPO_PUBLIC_WEB_API_URL (미설정 시 기본값). 실제 URL 하드코딩 금지.
 */
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { formatDate } from '@nexvoy/core'
import { supabase } from '@/lib/supabase'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

const WEB_API_BASE =
  process.env.EXPO_PUBLIC_WEB_API_URL ?? 'https://app.onvoy.travel'

type ShareType = 'public' | 'password'

interface ShareTripInfo {
  destination: string | null
  start_date: string | null
  end_date: string | null
  adults_count: number | null
  children_count: number | null
}

/** trips 조인 결과는 객체 또는 배열로 올 수 있어 단일 객체로 정규화한다. */
function normalizeTrip(value: unknown): ShareTripInfo | null {
  if (!value) return null
  const row = Array.isArray(value) ? value[0] : value
  if (!row || typeof row !== 'object') return null
  const t = row as Record<string, unknown>
  return {
    destination: typeof t.destination === 'string' ? t.destination : null,
    start_date: typeof t.start_date === 'string' ? t.start_date : null,
    end_date: typeof t.end_date === 'string' ? t.end_date : null,
    adults_count: typeof t.adults_count === 'number' ? t.adults_count : null,
    children_count:
      typeof t.children_count === 'number' ? t.children_count : null,
  }
}

export default function ShareDetailScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shareType, setShareType] = useState<ShareType | null>(null)
  const [tripInfo, setTripInfo] = useState<ShareTripInfo | null>(null)

  // 비밀번호 검증 상태
  const [password, setPassword] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)

  const isMounted = useRef(true)
  useEffect(() => () => { isMounted.current = false }, [])

  // share 정보 조회
  useEffect(() => {
    if (!id) {
      setError('유효하지 않은 공유 링크예요.')
      setLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        // password_hash 등 민감 컬럼은 select 하지 않는다.
        const { data: share, error: shareError } = await supabase
          .from('trip_shares')
          .select(
            'share_type, expires_at, trip_id, trips(destination, start_date, end_date, adults_count, children_count)'
          )
          .eq('share_token', id)
          .single()

        if (cancelled || !isMounted.current) return

        if (shareError || !share) {
          setError('존재하지 않거나 유효하지 않은 공유 링크예요.')
          return
        }

        // 만료 확인
        if (
          share.expires_at &&
          new Date(share.expires_at).getTime() < Date.now()
        ) {
          setError('만료된 공유 링크예요.')
          return
        }

        const type: ShareType = share.share_type === 'password' ? 'password' : 'public'
        setShareType(type)
        if (type === 'public') {
          setTripInfo(normalizeTrip(share.trips))
        }
      } catch {
        if (!cancelled && isMounted.current) {
          setError('공유 정보를 불러오지 못했어요.')
        }
      } finally {
        if (!cancelled && isMounted.current) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  const handleVerify = async () => {
    if (!id || verifying || password.trim().length === 0) return
    setVerifying(true)
    setPwError(null)
    try {
      const res = await fetch(`${WEB_API_BASE}/api/share/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: id, password }),
      })
      const json = await res.json().catch(() => ({ authorized: false }))

      if (!res.ok || !json?.authorized) {
        throw new Error('비밀번호가 일치하지 않아요.')
      }

      // 인증 성공 → 여정 정보를 다시 조회해 표시
      const { data: share, error: shareError } = await supabase
        .from('trip_shares')
        .select(
          'trips(destination, start_date, end_date, adults_count, children_count)'
        )
        .eq('share_token', id)
        .single()

      if (!isMounted.current) return
      if (shareError || !share) {
        throw new Error('여정 정보를 불러오지 못했어요.')
      }
      setTripInfo(normalizeTrip(share.trips))
      setShareType('public') // 인증 완료 → 정보 표시 모드로 전환
    } catch (e) {
      if (isMounted.current) {
        setPwError(e instanceof Error ? e.message : '비밀번호 확인에 실패했어요.')
      }
    } finally {
      if (isMounted.current) setVerifying(false)
    }
  }

  const canVerify = password.trim().length > 0 && !verifying

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressedFade]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.brand.ink} />
        </Pressable>
        <Text style={styles.headerTitle} accessibilityRole="header">
          공유된 여정
        </Text>
        <View style={styles.headerRight} />
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
          <Text style={styles.centerHint}>공유 정보를 불러오고 있어요…</Text>
        </View>
      ) : error ? (
        <View style={styles.centerFill}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={colors.brand.mutedSoft}
          />
          <Text style={styles.errorTitle}>{error}</Text>
          <Pressable
            onPress={() => router.replace('/(tabs)')}
            accessibilityRole="button"
            accessibilityLabel="홈으로 이동"
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && styles.pressedFade,
            ]}
          >
            <Text style={styles.secondaryBtnText}>홈으로</Text>
          </Pressable>
        </View>
      ) : shareType === 'password' && !tripInfo ? (
        // 비밀번호 입력 모드
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.pwBody}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.pwIconWrap}>
              <Ionicons
                name="lock-closed-outline"
                size={28}
                color={colors.brand.primary}
              />
            </View>
            <Text style={styles.pwTitle}>비밀번호로 보호된 여정이에요</Text>
            <Text style={styles.pwHint}>
              여정을 보려면 공유받은 비밀번호를 입력해 주세요.
            </Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>비밀번호</Text>
              <TextInput
                style={styles.fieldInput}
                value={password}
                onChangeText={(v) => {
                  setPassword(v)
                  if (pwError) setPwError(null)
                }}
                placeholder="비밀번호 입력"
                placeholderTextColor={colors.brand.mutedSoft}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleVerify}
                accessibilityLabel="공유 여정 비밀번호"
              />
              {pwError && <Text style={styles.fieldError}>{pwError}</Text>}
            </View>

            <Pressable
              onPress={handleVerify}
              disabled={!canVerify}
              accessibilityRole="button"
              accessibilityLabel="비밀번호 확인하기"
              accessibilityState={{ disabled: !canVerify }}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && canVerify && styles.pressedSoft,
                !canVerify && styles.primaryBtnDisabled,
              ]}
            >
              {verifying ? (
                <ActivityIndicator color={colors.bg.canvas} />
              ) : (
                <Text style={styles.primaryBtnText}>확인하기</Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : tripInfo ? (
        // 여정 정보 표시 모드 (읽기 전용)
        <ScrollView contentContainerStyle={styles.viewBody}>
          <View style={styles.readonlyBadge}>
            <Ionicons name="eye-outline" size={14} color={colors.brand.muted} />
            <Text style={styles.readonlyBadgeText}>읽기 전용 — 수정할 수 없어요</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Ionicons
                name="location-outline"
                size={18}
                color={colors.brand.muted}
              />
              <Text style={styles.infoLabel}>목적지</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {tripInfo.destination ?? '-'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons
                name="calendar-outline"
                size={18}
                color={colors.brand.muted}
              />
              <Text style={styles.infoLabel}>기간</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {tripInfo.start_date && tripInfo.end_date
                  ? `${formatDate(tripInfo.start_date)} ~ ${formatDate(tripInfo.end_date)}`
                  : '-'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Ionicons
                name="people-outline"
                size={18}
                color={colors.brand.muted}
              />
              <Text style={styles.infoLabel}>구성원</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {`성인 ${tripInfo.adults_count ?? 0}명` +
                  (tripInfo.children_count
                    ? `, 아동 ${tripInfo.children_count}명`
                    : '')}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => router.replace('/(tabs)')}
            accessibilityRole="button"
            accessibilityLabel="내 앱에서 여정 시작하기"
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.pressedSoft,
            ]}
          >
            <Text style={styles.primaryBtnText}>내 앱에서 여정 시작하기</Text>
          </Pressable>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  // 헤더
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand.border,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.brand.ink,
    textAlign: 'center',
  },
  headerRight: {
    width: 44,
    height: 44,
  },
  // 공통 상태
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  centerHint: {
    fontSize: fontSizes.sm,
    color: colors.brand.muted,
  },
  errorTitle: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    color: colors.brand.body,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  // 비밀번호 입력
  pwBody: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  pwIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.bg.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
  },
  pwTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.brand.ink,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  pwHint: {
    fontSize: fontSizes.sm,
    color: colors.brand.muted,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  field: {
    width: '100%',
    marginBottom: spacing.base,
  },
  fieldLabel: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.brand.muted,
    marginBottom: spacing.xs,
  },
  fieldInput: {
    height: 52,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.canvas,
    paddingHorizontal: spacing.md,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.normal,
    color: colors.brand.ink,
  },
  fieldError: {
    fontSize: fontSizes.sm,
    color: colors.brand.error,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  // 여정 표시
  viewBody: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  readonlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.bg.surfaceStrong,
    marginBottom: spacing.base,
  },
  readonlyBadgeText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.brand.muted,
  },
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.surfaceSoft,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoLabel: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.brand.muted,
    width: 56,
  },
  infoValue: {
    flex: 1,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    color: colors.brand.ink,
  },
  // 버튼
  primaryBtn: {
    width: '100%',
    height: 52,
    borderRadius: radii.sm,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    backgroundColor: colors.brand.primaryDisabled,
  },
  primaryBtnText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
    color: colors.bg.canvas,
  },
  secondaryBtn: {
    height: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand.border,
    backgroundColor: colors.bg.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  secondaryBtnText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    color: colors.brand.body,
  },
  // 인터랙션
  pressedSoft: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  pressedFade: {
    opacity: 0.6,
  },
})
