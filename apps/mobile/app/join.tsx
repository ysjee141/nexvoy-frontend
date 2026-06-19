/**
 * 초대 링크 여정 참여 화면 (nexvoy-app)
 *
 * 진입: 딥링크 `onvoy://join?token=XXX` 또는 앱 내 링크로 token 파라미터 수신.
 *
 * 흐름:
 *  1. 마운트 시 token 으로 getTripSummaryByToken 호출 → 여정 요약 표시
 *  2. [참여하기] → joinTripViaToken 호출 → 성공 시 해당 여정 상세로 replace
 *  3. 이미 참여 중("already")이면 안내 후 여정 상세로 이동
 *
 * 화면은 토큰 조회/참여 상태·검증만 담당하고, 데이터 접근은 @nexvoy/core 쿼리 경유(ADR-010).
 */
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  formatDate,
  getTripSummaryByToken,
  joinTripViaToken,
} from '@nexvoy/core'
import type { TripSummary } from '@nexvoy/types'
import { supabase } from '@/lib/supabase'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

export default function JoinScreen() {
  const router = useRouter()
  const { token } = useLocalSearchParams<{ token: string }>()

  const [summary, setSummary] = useState<TripSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  const isMounted = useRef(true)
  useEffect(() => () => { isMounted.current = false }, [])

  // 토큰으로 여정 요약 조회
  useEffect(() => {
    if (!token) {
      setError('유효하지 않은 초대 링크예요.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    getTripSummaryByToken(supabase, token)
      .then((result) => {
        if (!isMounted.current) return
        if (!result) {
          setError('초대 링크가 만료되었거나 유효하지 않아요.')
        } else {
          setSummary(result)
        }
      })
      .catch(() => {
        if (isMounted.current) setError('초대 정보를 불러오지 못했어요.')
      })
      .finally(() => {
        if (isMounted.current) setLoading(false)
      })
  }, [token])

  const goToTrip = () => {
    if (summary?.id) {
      router.replace({ pathname: '/trip/[id]', params: { id: summary.id } })
    } else {
      router.replace('/(tabs)')
    }
  }

  const handleJoin = async () => {
    if (!token || joining) return
    setJoining(true)
    try {
      await joinTripViaToken(supabase, token)
      // 성공 → 해당 여정 상세로 이동
      goToTrip()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '참여에 실패했어요.'
      // "already a member" 류 에러: 이미 참여 중인 경우 여정으로 안내
      if (msg.toLowerCase().includes('already')) {
        Alert.alert('알림', '이미 참여 중인 여정이에요.', [
          { text: '여정 보러가기', onPress: goToTrip },
        ])
      } else {
        Alert.alert('오류', msg)
      }
    } finally {
      if (isMounted.current) setJoining(false)
    }
  }

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
          여정 초대
        </Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.body}>
        {loading ? (
          <View style={styles.centerFill}>
            <ActivityIndicator size="large" color={colors.brand.primary} />
            <Text style={styles.centerHint}>초대 정보를 확인하고 있어요…</Text>
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
        ) : summary ? (
          <>
            {/* 여정 정보 카드 */}
            <View style={styles.card}>
              <View style={styles.cardIconWrap}>
                <Ionicons
                  name="airplane-outline"
                  size={28}
                  color={colors.brand.primary}
                />
              </View>
              <Text style={styles.cardLead}>
                {summary.owner_nickname
                  ? `${summary.owner_nickname}님이 여정에 초대했어요`
                  : '여정에 초대받았어요'}
              </Text>

              <View style={styles.infoRow}>
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={colors.brand.muted}
                />
                <Text style={styles.infoLabel}>목적지</Text>
                <Text style={styles.infoValue} numberOfLines={1}>
                  {summary.destination}
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
                  {formatDate(summary.start_date)} ~ {formatDate(summary.end_date)}
                </Text>
              </View>
            </View>

            {/* 액션 */}
            <Pressable
              onPress={handleJoin}
              disabled={joining}
              accessibilityRole="button"
              accessibilityLabel="여정에 참여하기"
              accessibilityState={{ disabled: joining }}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && !joining && styles.pressedSoft,
                joining && styles.primaryBtnDisabled,
              ]}
            >
              {joining ? (
                <ActivityIndicator color={colors.bg.canvas} />
              ) : (
                <Text style={styles.primaryBtnText}>참여하기</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => router.back()}
              disabled={joining}
              accessibilityRole="button"
              accessibilityLabel="초대 참여 취소"
              hitSlop={8}
              style={({ pressed }) => [
                styles.cancelBtn,
                pressed && styles.pressedFade,
              ]}
            >
              <Text style={styles.cancelBtnText}>취소</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
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
  // 본문
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
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
  // 여정 정보 카드
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.surfaceSoft,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  cardIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.bg.canvas,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  cardLead: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.brand.ink,
    textAlign: 'center',
    marginBottom: spacing.xs,
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
  cancelBtn: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  cancelBtnText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    color: colors.brand.muted,
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
