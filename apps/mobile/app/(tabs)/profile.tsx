/**
 * 프로필 탭 — 사용자 정보 표시 + 로그아웃.
 * @nexvoy/core 의 getProfile 쿼리를 supabase client 주입하여 사용(ADR-010).
 * avatar_url 미설정 시 닉네임/이메일 이니셜 원형으로 대체.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { getProfile, getTravelStats } from '@nexvoy/core'
import type { Profile, TravelStats } from '@nexvoy/types'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { ConfirmSheet } from '@/components/ui'
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
  icon: React.ComponentProps<typeof Ionicons>['name']
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
        name={icon}
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
  const [stats, setStats] = useState<TravelStats | null>(null)
  const [loading, setLoading] = useState(true)

  // 닉네임 인라인 편집 상태
  const [isEditingNickname, setIsEditingNickname] = useState(false)
  const [editNickname, setEditNickname] = useState('')
  const [isSavingNickname, setIsSavingNickname] = useState(false)
  const [nicknameError, setNicknameError] = useState('')
  const [showLogoutSheet, setShowLogoutSheet] = useState(false)

  const loadProfile = useCallback(async () => {
    if (!session?.user) return
    setLoading(true)
    try {
      const [profileData, statsData] = await Promise.all([
        getProfile(supabase, session.user.id),
        getTravelStats(supabase, session.user.id).catch(() => null),
      ])
      if (isMounted.current) {
        setProfile(profileData)
        if (statsData) setStats(statsData)
      }
    } catch {
      // 로드 실패 시 session 기본값으로 표시
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }, [session?.user])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const startEditingNickname = () => {
    setEditNickname(profile?.nickname || displayName)
    setNicknameError('')
    setIsEditingNickname(true)
  }

  const cancelEditingNickname = () => {
    setIsEditingNickname(false)
    setNicknameError('')
  }

  const saveNickname = async () => {
    if (!editNickname.trim() || !session?.user) return
    setNicknameError('')
    setIsSavingNickname(true)
    try {
      // 닉네임 중복 체크
      const { data: existing } = await supabase
        .from('profiles')
        .select('nickname')
        .ilike('nickname', editNickname.trim())
        .neq('id', session.user.id)
        .maybeSingle()

      if (existing) {
        if (isMounted.current) {
          setNicknameError('이미 사용 중인 닉네임입니다.')
          setIsSavingNickname(false)
        }
        return
      }

      const { error } = await supabase
        .from('profiles')
        .update({ nickname: editNickname.trim(), updated_at: new Date().toISOString() })
        .eq('id', session.user.id)

      if (error) throw error

      if (isMounted.current) {
        setProfile((prev) => (prev ? { ...prev, nickname: editNickname.trim() } : prev))
        setIsEditingNickname(false)
      }
    } catch {
      if (isMounted.current) {
        setNicknameError('닉네임을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.')
      }
    } finally {
      if (isMounted.current) setIsSavingNickname(false)
    }
  }

  const handleSignOut = () => {
    setShowLogoutSheet(true)
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
            {isEditingNickname ? (
              <View style={styles.nicknameEditWrap}>
                <View style={styles.nicknameEditRow}>
                  <TextInput
                    value={editNickname}
                    onChangeText={setEditNickname}
                    style={styles.nicknameInput}
                    placeholder="닉네임"
                    placeholderTextColor={colors.brand.mutedSoft}
                    autoFocus
                    maxLength={20}
                    returnKeyType="done"
                    onSubmitEditing={saveNickname}
                    editable={!isSavingNickname}
                    accessibilityLabel="닉네임 입력"
                  />
                  <Pressable
                    onPress={saveNickname}
                    disabled={isSavingNickname || !editNickname.trim()}
                    style={({ pressed }) => [
                      styles.nicknameIconBtn,
                      (isSavingNickname || !editNickname.trim()) && { opacity: 0.4 },
                      pressed && { opacity: 0.6 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="닉네임 저장"
                  >
                    {isSavingNickname ? (
                      <ActivityIndicator size="small" color={colors.brand.primary} />
                    ) : (
                      <Ionicons
                        name="checkmark-outline"
                        size={20}
                        color={colors.brand.primary}
                      />
                    )}
                  </Pressable>
                  <Pressable
                    onPress={cancelEditingNickname}
                    disabled={isSavingNickname}
                    style={({ pressed }) => [
                      styles.nicknameIconBtn,
                      pressed && { opacity: 0.6 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="편집 취소"
                  >
                    <Ionicons name="close-outline" size={20} color={colors.brand.muted} />
                  </Pressable>
                </View>
                {nicknameError ? (
                  <Text style={styles.nicknameError}>{nicknameError}</Text>
                ) : null}
              </View>
            ) : (
              <Pressable
                onPress={startEditingNickname}
                style={({ pressed }) => [
                  styles.nicknameDisplayRow,
                  pressed && { opacity: 0.6 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="닉네임 편집"
              >
                <Text style={styles.displayName}>{displayName}</Text>
                <Ionicons
                  name="pencil-outline"
                  size={16}
                  color={colors.brand.muted}
                />
              </Pressable>
            )}
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

          {/* 여행 통계 (2×2 그리드) */}
          {stats ? (
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.completedCount}회</Text>
                <Text style={styles.statLabel}>완료한 여행</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.upcomingTrips.length}회</Text>
                <Text style={styles.statLabel}>예정된 여행</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.totalDays}일</Text>
                <Text style={styles.statLabel}>총 여행일</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.uniqueDestinations}곳</Text>
                <Text style={styles.statLabel}>방문한 곳</Text>
              </View>
            </View>
          ) : null}

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
              icon="shield-checkmark-outline"
              label="약관 및 개인정보 정책"
              onPress={() => router.push('/profile/terms')}
            />
            <NavRow
              icon="document-text-outline"
              label="오픈소스 라이선스"
              onPress={() => router.push('/profile/licenses')}
            />
          </View>

          {/* 보조 계정 액션 */}
          <View style={styles.accountFooter}>
            <Pressable
              onPress={handleSignOut}
              hitSlop={10}
              style={({ pressed }) => pressed && styles.pressedFade}
              accessibilityRole="button"
              accessibilityLabel="로그아웃"
            >
              <Text style={styles.accountFooterLink}>로그아웃</Text>
            </Pressable>
            <Text style={styles.accountFooterDivider}>·</Text>
            <Pressable
              onPress={() => router.push('/profile/withdrawal')}
              hitSlop={10}
              style={({ pressed }) => pressed && styles.pressedFade}
              accessibilityRole="button"
              accessibilityLabel="회원 탈퇴"
            >
              <Text style={[styles.accountFooterLink, styles.withdrawalLink]}>
                회원 탈퇴
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
      <ConfirmSheet
        visible={showLogoutSheet}
        title="로그아웃"
        message="정말 로그아웃 하시겠어요?"
        confirmLabel="로그아웃"
        destructive
        onConfirm={() => {
          setShowLogoutSheet(false)
          signOut()
        }}
        onCancel={() => setShowLogoutSheet(false)}
      />
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
  nicknameDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  displayName: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
  },
  // 닉네임 인라인 편집
  nicknameEditWrap: {
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'stretch',
    paddingHorizontal: spacing.lg,
  },
  nicknameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'stretch',
  },
  nicknameInput: {
    flex: 1,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
    textAlign: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand.primary,
    backgroundColor: colors.bg.canvas,
  },
  nicknameIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  nicknameError: {
    fontSize: fontSizes.xs,
    color: colors.brand.error,
    textAlign: 'center',
  },
  // 통계 그리드
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    margin: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    alignItems: 'center',
    backgroundColor: colors.bg.surfaceSoft,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.border,
  },
  statValue: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.brand.primary,
  },
  statLabel: {
    fontSize: fontSizes.xs,
    color: colors.brand.muted,
    marginTop: spacing.xxs,
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
  // 보조 계정 액션
  accountFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: 'auto',
    marginBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  accountFooterLink: {
    fontSize: fontSizes.sm,
    color: colors.brand.mutedSoft,
    textDecorationLine: 'underline',
  },
  accountFooterDivider: {
    fontSize: fontSizes.sm,
    color: colors.brand.mutedSoft,
  },
  withdrawalLink: {
    color: colors.brand.mutedSoft,
  },
  pressedFade: { opacity: 0.6 },
})
