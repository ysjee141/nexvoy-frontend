/**
 * 새 템플릿 만들기 화면 (nexvoy-app)
 *
 * trip/new.tsx 의 폼 디자인 언어(독립 필드, primary 제출 버튼, 고정 헤더)를 계승.
 * 제목(필수) + 항목 리스트(로컬 배열)를 관리하고, 저장 시
 * createTemplate → replaceTemplateItems 순서로 호출한 뒤 router.back().
 *
 * category 는 빈 문자열로 저장(웹도 단순 항목만 사용). 화면은 폼 UI/검증/상태만 담당.
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
import { useRouter } from 'expo-router'
import { createTemplate, getChecklistCategories, replaceTemplateItems } from '@nexvoy/core'
import type { ChecklistCategory } from '@nexvoy/types'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

const TITLE_MAX = 50
const ITEM_MAX = 50
type TemplateDraftItem = {
  id: string
  item_name: string
  category: string
  is_private: boolean
}

export default function NewTemplateScreen() {
  const router = useRouter()
  const { session } = useAuth()

  const [title, setTitle] = useState('')
  const [itemDraft, setItemDraft] = useState('')
  const [itemCategory, setItemCategory] = useState('기타')
  const [itemPrivate, setItemPrivate] = useState(false)
  const [items, setItems] = useState<TemplateDraftItem[]>([])
  const [categories, setCategories] = useState<ChecklistCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(true)
  useEffect(() => () => { isMounted.current = false }, [])
  useEffect(() => {
    if (!session?.user) return
    getChecklistCategories(supabase, session.user.id)
      .then((data) => {
        if (isMounted.current) setCategories(data)
      })
      .catch(() => {
        if (isMounted.current) setCategories([])
      })
  }, [session?.user])

  const trimmedDraft = itemDraft.trim()
  const canAddItem = trimmedDraft.length > 0
  const canSubmit = title.trim().length > 0 && !loading

  const handleAddItem = () => {
    if (!canAddItem) return
    setItems((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${prev.length}`,
        item_name: trimmedDraft,
        category: itemCategory.trim() || '기타',
        is_private: itemPrivate,
      },
    ])
    setItemDraft('')
    setItemPrivate(false)
  }

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!canSubmit || !session?.user) return
    setLoading(true)
    setError(null)
    try {
      const template = await createTemplate(supabase, {
        title: title.trim(),
        user_id: session.user.id,
      })
      await replaceTemplateItems(
        supabase,
        template.id,
        items.map((item) => ({
          item_name: item.item_name,
          category: item.category,
          is_private: item.is_private,
        }))
      )
      router.back()
    } catch (e) {
      if (isMounted.current) {
        setError(
          e instanceof Error
            ? e.message
            : '템플릿 저장에 실패했어요. 잠시 후 다시 시도해 주세요.'
        )
      }
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
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
          새 템플릿
        </Text>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollBody}
          keyboardShouldPersistTaps="handled"
        >
          {/* 템플릿 이름 */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>템플릿 이름</Text>
            <TextInput
              style={styles.fieldInput}
              value={title}
              onChangeText={setTitle}
              maxLength={TITLE_MAX}
              autoCorrect={false}
              placeholder="예) 여름 여행 기본 준비물"
              placeholderTextColor={colors.brand.mutedSoft}
              returnKeyType="next"
              accessibilityLabel="템플릿 이름 입력"
            />
          </View>

          {/* 항목 추가 */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>항목 추가</Text>
            <View style={styles.addRow}>
              <TextInput
                style={[styles.fieldInput, styles.addInput]}
                value={itemDraft}
                onChangeText={setItemDraft}
                maxLength={ITEM_MAX}
                autoCorrect={false}
                placeholder="항목 이름"
                placeholderTextColor={colors.brand.mutedSoft}
                returnKeyType="done"
                onSubmitEditing={handleAddItem}
                accessibilityLabel="추가할 항목 이름 입력"
              />
              <Pressable
                onPress={handleAddItem}
                disabled={!canAddItem}
                accessibilityRole="button"
                accessibilityLabel="항목 추가"
                accessibilityState={{ disabled: !canAddItem }}
                style={({ pressed }) => [
                  styles.addBtn,
                  !canAddItem && styles.addBtnDisabled,
                  pressed && canAddItem && styles.pressedSoft,
                ]}
              >
                <Text
                  style={[
                    styles.addBtnText,
                    !canAddItem && styles.addBtnTextDisabled,
                  ]}
                >
                  추가
                </Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryChips}
            >
              {(categories.length > 0 ? categories : [{ id: 'fallback', name: '기타' } as ChecklistCategory]).map((category) => {
                const selected = itemCategory === category.name
                return (
                  <Pressable
                    key={category.id}
                    onPress={() => setItemCategory(category.name)}
                    style={[styles.categoryChip, selected && styles.categoryChipActive]}
                  >
                    <Text style={[styles.categoryChipText, selected && styles.categoryChipTextActive]}>
                      {category.name}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>
            <Pressable
              onPress={() => setItemPrivate((prev) => !prev)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: itemPrivate }}
              style={styles.privateToggle}
            >
              <Ionicons
                name={itemPrivate ? 'lock-closed' : 'lock-open-outline'}
                size={16}
                color={itemPrivate ? colors.brand.primary : colors.brand.muted}
              />
              <Text style={[styles.privateToggleText, itemPrivate && styles.privateToggleTextActive]}>
                비공개 항목
              </Text>
            </Pressable>
          </View>

          {/* 항목 리스트 */}
          {items.length > 0 && (
            <View style={styles.itemList}>
              {items.map((item, index) => (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.itemTextBlock}>
                    <Text style={styles.itemText} numberOfLines={1}>
                      {item.item_name}
                    </Text>
                    <Text style={styles.itemMeta} numberOfLines={1}>
                      {item.category}{item.is_private ? ' · 비공개' : ''}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleRemoveItem(index)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.item_name} 항목 삭제`}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.itemRemoveBtn,
                      pressed && styles.pressedFade,
                    ]}
                  >
                    <Ionicons name="close" size={18} color={colors.brand.muted} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {/* 서버 에러 */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* 제출 */}
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel="템플릿 저장하기"
            accessibilityState={{ disabled: !canSubmit }}
            style={({ pressed }) => [
              styles.submitBtn,
              pressed && canSubmit && styles.pressedSoft,
              !canSubmit && styles.submitBtnDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator color={colors.bg.canvas} />
            ) : (
              <Text style={styles.submitBtnText}>템플릿 저장하기</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg.canvas },
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
  headerRight: { width: 44, height: 44 },
  // 본문
  scrollBody: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  field: { marginBottom: spacing.base },
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
  // 항목 추가 행
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  addInput: { flex: 1 },
  addBtn: {
    height: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    backgroundColor: colors.bg.surfaceStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: { opacity: 0.6 },
  addBtnText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.brand.ink,
  },
  addBtnTextDisabled: { color: colors.brand.mutedSoft },
  categoryChips: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  categoryChip: {
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.bg.canvas,
  },
  categoryChipActive: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.bg.surfaceSoft,
  },
  categoryChipText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.brand.muted,
  },
  categoryChipTextActive: {
    color: colors.brand.primary,
  },
  privateToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  privateToggleText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.brand.muted,
  },
  privateToggleTextActive: {
    color: colors.brand.primary,
  },
  // 항목 리스트
  itemList: {
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.surfaceSoft,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  itemText: {
    flex: 1,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.normal,
    color: colors.brand.ink,
  },
  itemTextBlock: { flex: 1 },
  itemMeta: {
    fontSize: fontSizes.xs,
    color: colors.brand.muted,
    marginTop: 2,
  },
  itemRemoveBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 에러 박스
  errorBox: {
    padding: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand.error,
    backgroundColor: colors.bg.surfaceSoft,
    marginBottom: spacing.base,
  },
  errorText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    color: colors.brand.error,
  },
  // 제출 버튼
  submitBtn: {
    marginTop: spacing.sm,
    height: 52,
    borderRadius: radii.sm,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { backgroundColor: colors.brand.primaryDisabled },
  submitBtnText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
    color: colors.bg.canvas,
  },
  // 인터랙션
  pressedSoft: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  pressedFade: { opacity: 0.6 },
})
