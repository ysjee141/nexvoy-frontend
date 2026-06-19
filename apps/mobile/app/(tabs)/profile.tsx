/**
 * 프로필 탭 — 사용자 정보 표시 + 로그아웃.
 * @nexvoy/core 의 getProfile 쿼리를 supabase client 주입하여 사용(ADR-010).
 * avatar_url 미설정 시 닉네임/이메일 이니셜 원형으로 대체.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { getProfile } from '@nexvoy/core'
import type { Profile } from '@nexvoy/types'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

function getInitial(nickname: string | null, email: string | null): string {
  const src = nickname?.trim() || email?.trim() || '?'
  return src[0].toUpperCase()
}

function formatJoinedDate(createdAt: string): string {
  const [year, month, day] = createdAt.slice(0, 10).split('-')
  return `${year}년 ${Number(month)}월 ${Number(day)}일 가입`
}

function NavRow({
  icon,
  label,
  onPress,
  destructive = false,
}: {
  icon: string
  label: string
  onPress: () => void
  destructive?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.navRow, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons
        name={icon as any}
        size={18}
        color={destructive ? colors.brand.error : colors.brand.muted}
      />
      <Text style={[styles.navRowLabel, destructive && { color: colors.brand.error }]}>
        {label}
      </Text>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={colors.brand.mutedSoft}
        style={{ marginLeft: 'auto' }}
      />
    </Pressable>
  )
}

export default function ProfileScreen() {
  const router = useRouter()
  const { session, signOut } = useAuth()
  const isMounted = useRef(true)
  useEffect(() => { return () => { isMounted.current = false } }, [])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async () => {
    if (!session?.user) return
    setLoading(true)
    try {
      const data = await getProfile(supabase, session.user.id)
      if (isMounted.current) setProfile(data)
    } catch {
      // 로드 실패 시 session 기본값으로 표시
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }, [session?.user])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const handleSignOut = () => {
    Alert.alert('로그아웃', '정말 로그아웃 하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: signOut,
      },
    ])
  }

  const displayName = profile?.nickname || session?.user?.email?.split('@')[0] || '여행자'
  const displayEmail = profile?.email || session?.user?.email || ''
  const initial = getInitial(profile?.nickname ?? null, displayEmail)
  const isGoogle = profile?.auth_provider === 'google'

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>프로필</Text>
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          {/* 아바타 + 이름 */}
          <View style={styles.heroCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
            <Text style={styles.displayName}>{displayName}</Text>
            <Text style={styles.displayEmail}>{displayEmail}</Text>

            {/* 가입 경로 배지 */}
            <View style={styles.providerBadge}>
              <Ionicons
                name={isGoogle ? 'logo-google' : 'mail-outline'}
                size={13}
                color={colors.brand.muted}
              />
              <Text style={styles.providerText}>
                {isGoogle ? 'Google 계정' : '이메일 계정'}
              </Text>
            </View>
          </View>

          {/* 정보 행 */}
          <View style={styles.infoSection}>
            {profile?.created_at ? (
              <View style={styles.infoRow}>
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={colors.brand.mutedSoft}
                />
                <Text style={styles.infoText}>
                  {formatJoinedDate(profile.created_at)}
                </Text>
              </View>
            ) : null}
          </View>

          {/* 내 여행 */}
          <View style={styles.navSection}>
            <NavRow
              icon="stats-chart-outline"
              label="여행 기록"
              onPress={() => router.push('/profile/travel-log')}
            />
            <NavRow
              icon="location-outline"
              label="방문한 곳"
              onPress={() => router.push('/profile/places-visited')}
            />
          </View>

          {/* 앱 정보 */}
          <View style={styles.navSection}>
            <NavRow
              icon="document-text-outline"
              label="오픈소스 라이선스"
              onPress={() => router.push('/profile/licenses')}
            />
          </View>

          {/* 계정 */}
          <View style={styles.navSection}>
            <NavRow
              icon="trash-outline"
              label="회원 탈퇴"
              onPress={() => router.push('/profile/withdrawal')}
              destructive
            />
          </View>

          {/* 로그아웃 */}
          <Pressable
            onPress={handleSignOut}
            style={({ pressed }) => [
              styles.signOutBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons
              name="log-out-outline"
              size={18}
              color={colors.brand.error}
            />
            <Text style={styles.signOutText}>로그아웃</Text>
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.canvas },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.brand.border,
  },
  title: {
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
    letterSpacing: -0.5,
  },
  flex: { flex: 1 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  // 아바타 히어로 카드
  heroCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.bg.surfaceSoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.brand.border,
    gap: spacing.sm,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radii.full,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarInitial: {
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.bold,
    color: colors.bg.canvas,
  },
  displayName: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
  },
  displayEmail: {
    fontSize: fontSizes.sm,
    color: colors.brand.muted,
  },
  providerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
    borderRadius: radii.full,
    backgroundColor: colors.bg.canvas,
    borderWidth: 1,
    borderColor: colors.brand.border,
  },
  providerText: {
    fontSize: fontSizes.xs,
    color: colors.brand.muted,
  },
  // 정보 행
  infoSection: {
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    backgroundColor: colors.bg.surfaceSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.border,
  },
  infoText: {
    fontSize: fontSizes.sm,
    color: colors.brand.muted,
  },
  // 서브 내비
  navSection: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.border,
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    backgroundColor: colors.bg.canvas,
  },
  navRowLabel: {
    fontSize: fontSizes.base,
    color: colors.brand.ink,
  },
  // 로그아웃
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.base,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand.error,
    marginTop: 'auto',
    marginBottom: spacing.lg,
  },
  signOutText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.brand.error,
  },
})
