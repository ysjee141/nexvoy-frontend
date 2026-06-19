/**
 * 준비물 템플릿 탭 — 템플릿 목록 + 빈 상태 + FAB.
 * @nexvoy/core 의 getTemplatesWithItemCount / deleteTemplate 를 supabase client 주입하여 사용(ADR-010).
 * loading / empty / list 3-상태 분기. 디자인 토큰은 @/theme 사용.
 *
 * 카드 탭 → 편집(/templates/[id]), FAB → 생성(/templates/new).
 * 카드 롱프레스 → Alert 확인 → deleteTemplate → 목록 갱신.
 * useFocusEffect 로 생성/편집 후 복귀 시 자동 재조회.
 */
import { useCallback, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getTemplatesWithItemCount, deleteTemplate } from '@nexvoy/core'
import type { TemplateWithCount } from '@nexvoy/types'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { colors, fontSizes, fontWeights, radii, spacing, shadows } from '@/theme'

export default function TemplatesScreen() {
  const { session } = useAuth()
  const router = useRouter()
  const [templates, setTemplates] = useState<TemplateWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const isMounted = useRef(true)

  const loadTemplates = useCallback(async () => {
    if (!session?.user) return
    setLoading(true)
    try {
      const data = await getTemplatesWithItemCount(supabase, session.user.id)
      if (isMounted.current) setTemplates(data)
    } catch {
      // 조회 실패 시 직전 목록 유지 (useFocusEffect 재진입 시 깜박임 방지)
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }, [session?.user])

  useFocusEffect(
    useCallback(() => {
      isMounted.current = true
      loadTemplates()
      return () => {
        isMounted.current = false
      }
    }, [loadTemplates])
  )

  const handleDelete = useCallback(
    (template: TemplateWithCount) => {
      // 공개 템플릿(user_id=null)은 삭제 불가 — 본인 소유만 삭제.
      if (!template.user_id) return
      Alert.alert(
        '템플릿 삭제',
        `'${template.title}' 템플릿을 삭제할까요? 이 작업은 되돌릴 수 없어요.`,
        [
          { text: '취소', style: 'cancel' },
          {
            text: '삭제',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteTemplate(supabase, template.id)
                await loadTemplates()
              } catch {
                Alert.alert(
                  '삭제 실패',
                  '템플릿을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.'
                )
              }
            },
          },
        ]
      )
    },
    [loadTemplates]
  )

  const renderTemplate = ({ item }: { item: TemplateWithCount }) => (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/templates/[id]', params: { id: item.id } })
      }
      onLongPress={() => handleDelete(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.title} 템플릿, 항목 ${item.item_count}개. 탭하면 수정, 길게 누르면 삭제`}
      style={({ pressed }) => [
        styles.templateCard,
        pressed && styles.pressedSoft,
      ]}
    >
      <View style={styles.templateBody}>
        <Text style={styles.templateTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.templateCount}>항목 {item.item_count}개</Text>
      </View>
      <View style={styles.editHint}>
        <Text style={styles.editHintText}>수정</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.brand.mutedSoft} />
      </View>
    </Pressable>
  )

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading} accessibilityRole="header">
          준비물 템플릿
        </Text>
        <Text style={styles.subheading}>
          자주 쓰는 준비물 목록을 템플릿으로 저장하세요.
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      ) : templates.length > 0 ? (
        <>
          <FlatList
            data={templates}
            keyExtractor={(t) => t.id}
            renderItem={renderTemplate}
            contentContainerStyle={styles.listBody}
          />
          <Pressable
            onPress={() => router.push('/templates/new')}
            accessibilityRole="button"
            accessibilityLabel="새 템플릿 만들기"
            style={({ pressed }) => [
              styles.fab,
              pressed && { opacity: 0.92, transform: [{ scale: 0.96 }] },
            ]}
          >
            <Ionicons name="add" size={28} color={colors.bg.canvas} />
          </Pressable>
        </>
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.emptyIllust}>
            <Ionicons name="list-outline" size={40} color={colors.brand.mutedSoft} />
          </View>
          <Text style={styles.emptyTitle}>아직 템플릿이 없어요</Text>
          <Text style={styles.emptyDesc}>
            나만의 준비물 목록을 템플릿으로 만들어 보세요.
          </Text>
          <Pressable
            onPress={() => router.push('/templates/new')}
            accessibilityRole="button"
            accessibilityLabel="새 템플릿 만들기"
            style={({ pressed }) => [
              styles.emptyCta,
              pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text style={styles.emptyCtaText}>새 템플릿 만들기</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.canvas },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
    paddingBottom: spacing.md,
  },
  heading: {
    fontSize: fontSizes['3xl'],
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: fontSizes.md,
    color: colors.brand.muted,
    marginTop: spacing.xs,
  },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.canvas,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.border,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.card,
  },
  templateBody: { flex: 1 },
  templateTitle: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    color: colors.brand.ink,
  },
  templateCount: {
    fontSize: fontSizes.sm,
    color: colors.brand.muted,
    marginTop: spacing.xxs,
  },
  editHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  editHintText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.brand.muted,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.base,
  },
  emptyIllust: {
    width: 96,
    height: 96,
    borderRadius: radii.full,
    backgroundColor: colors.bg.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.brand.ink,
  },
  emptyDesc: {
    fontSize: fontSizes.md,
    color: colors.brand.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyCta: {
    backgroundColor: colors.brand.primary,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  emptyCtaText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
    color: colors.bg.canvas,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.fab,
  },
  pressedSoft: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
})
