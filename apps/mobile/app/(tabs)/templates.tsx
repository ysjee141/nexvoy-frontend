/**
 * 준비물 템플릿 탭 — 템플릿 목록 + 빈 상태 + FAB.
 * @nexvoy/core 의 getTemplatesWithPreview / deleteTemplate 를 supabase client 주입하여 사용(ADR-010).
 * loading / empty / list 3-상태 분기. 디자인 토큰은 @/theme 사용.
 *
 * 카드 구조는 웹(apps/web/app/templates/page.tsx)의 TripSection 카드를 모바일에 맞춰 정렬:
 *   아이콘 + 제목 + 항목 수 배지 / preview_items 태그 / 생성일.
 * 카드 탭 → 편집(/templates/[id]), FAB → 생성(/templates/new).
 * 카드 롱프레스 → Alert 확인 → deleteTemplate → 목록 갱신.
 *   (공개 템플릿은 RLS 로 삭제가 차단되며, 실패 시 사용자 안내 Alert 노출)
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { getTemplatesWithPreview, deleteTemplate } from '@nexvoy/core'
import type { TemplateWithPreview } from '@nexvoy/types'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { ConfirmSheet, EmptyState } from '@/components/ui'
import { colors, fontSizes, fontWeights, radii, spacing, shadows } from '@/theme'

/**
 * created_at(ISO 문자열)을 'YYYY년 M월 D일 등록' 형식으로 변환.
 * new Date() 파싱 시 타임존 오프셋으로 날짜가 밀릴 수 있어 문자열 슬라이싱으로 추출한다.
 */
function formatRegisteredDate(createdAt: string): string {
  const year = createdAt.slice(0, 4)
  // 앞자리 0 제거 (01월 → 1월)
  const month = String(Number(createdAt.slice(5, 7)))
  const day = String(Number(createdAt.slice(8, 10)))
  return `${year}년 ${month}월 ${day}일 등록`
}

export default function TemplatesScreen() {
  const { session } = useAuth()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [templates, setTemplates] = useState<TemplateWithPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingDelete, setPendingDelete] = useState<TemplateWithPreview | null>(null)
  const isMounted = useRef(true)

  const loadTemplates = useCallback(async () => {
    if (!session?.user) return
    setLoading(true)
    try {
      const data = await getTemplatesWithPreview(supabase, session.user.id)
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
    (template: TemplateWithPreview) => {
      // 공개/공유 템플릿은 삭제 불가 — 본인 소유만 삭제.
      if (template.access !== 'owner') return
      setPendingDelete(template)
    },
    []
  )

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return
    try {
      await deleteTemplate(supabase, pendingDelete.id)
      setPendingDelete(null)
      await loadTemplates()
    } catch {
      Alert.alert('삭제 실패', '템플릿을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.')
    }
  }, [loadTemplates, pendingDelete])

  const renderTemplate = ({ item }: { item: TemplateWithPreview }) => {
    const overflowCount = item.item_count - item.preview_items.length
    const accessLabel =
      item.access === 'owner'
        ? 'MY'
        : item.access === 'editor'
          ? 'EDIT'
          : item.access === 'viewer'
            ? 'SHARED'
            : 'BASIC'
    return (
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
        {/* 상단: 아이콘 + 제목 + 항목 수 배지 */}
        <View style={styles.cardHeader}>
          <View style={styles.iconBadge}>
            <Ionicons
              name="checkbox-outline"
              size={20}
              color={colors.brand.primary}
            />
          </View>
          <Text style={styles.templateTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.templateCount}>항목 {item.item_count}개</Text>
        </View>
        <Text style={styles.accessBadge}>{accessLabel}</Text>

        {/* 중단: preview_items 태그 (최대 3개 + 초과분) */}
        {item.preview_items.length > 0 ? (
          <View style={styles.tagRow}>
            {item.preview_items.map((name, idx) => (
              <View key={`${item.id}-${idx}`} style={styles.tag}>
                <Text style={styles.tagText} numberOfLines={1}>
                  {name}
                </Text>
              </View>
            ))}
            {overflowCount > 0 && (
              <View style={[styles.tag, styles.tagMore]}>
                <Text style={[styles.tagText, styles.tagMoreText]}>
                  +{overflowCount}개
                </Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={styles.emptyItems}>등록된 준비물이 없어요.</Text>
        )}

        {/* 하단: 생성일 */}
        <Text style={styles.createdAt}>{formatRegisteredDate(item.created_at)}</Text>
      </Pressable>
    )
  }

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
              { bottom: Math.max(insets.bottom, spacing.base) + spacing.lg },
              pressed && { opacity: 0.92, transform: [{ scale: 0.96 }] },
            ]}
          >
            <Ionicons name="add" size={28} color={colors.bg.canvas} />
          </Pressable>
        </>
      ) : (
        <View style={styles.emptyState}>
          <EmptyState
            icon="list-outline"
            title="아직 템플릿이 없어요"
            description="나만의 준비물 목록을 템플릿으로 만들어 보세요."
            actionLabel="새 템플릿 만들기"
            onAction={() => router.push('/templates/new')}
          />
        </View>
      )}
      <ConfirmSheet
        visible={pendingDelete !== null}
        title="템플릿 삭제"
        message={
          pendingDelete
            ? `'${pendingDelete.title}' 템플릿을 삭제할까요? 이 작업은 되돌릴 수 없어요.`
            : ''
        }
        confirmLabel="삭제"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
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
  },
  templateCard: {
    backgroundColor: colors.bg.canvas,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.border,
    padding: spacing.base,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.bg.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateTitle: {
    flex: 1,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
  },
  templateCount: {
    fontSize: fontSizes.xs,
    color: colors.brand.muted,
  },
  accessBadge: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.bg.surfaceSoft,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.brand.primary,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  tag: {
    borderRadius: radii.xs,
    backgroundColor: colors.bg.surfaceSoft,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: fontSizes.xs,
    color: colors.brand.ink,
  },
  tagMore: {
    backgroundColor: colors.brand.primary,
  },
  tagMoreText: {
    color: colors.bg.canvas,
    fontWeight: fontWeights.semibold,
  },
  emptyItems: {
    fontSize: fontSizes.xs,
    color: colors.brand.mutedSoft,
    marginTop: spacing.md,
  },
  createdAt: {
    fontSize: fontSizes.xs,
    color: colors.brand.mutedSoft,
    marginTop: spacing.md,
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
