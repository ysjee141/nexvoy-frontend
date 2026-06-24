/**
 * 새 템플릿 만들기 화면 (nexvoy-app)
 *
 * trip/new.tsx 의 폼 디자인 언어(독립 필드, primary 제출 버튼, 고정 헤더)를 계승.
 * 제목(필수) + 항목 리스트(로컬 배열)를 관리하고, 저장 시
 * createTemplate → replaceTemplateItems 순서로 호출한 뒤 router.back().
 *
 * category 는 빈 문자열로 저장(웹도 단순 항목만 사용). 화면은 폼 UI/검증/상태만 담당.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [categoryQuery, setCategoryQuery] = useState('')
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
  const categoryOptions = useMemo(() => {
    const base = categories.length > 0 ? categories : [{ id: 'fallback', name: '기타' } as ChecklistCategory]
    const seen = new Set<string>()
    return base.filter((category) => {
      const key = category.name.trim().toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [categories])
  const filteredCategoryOptions = useMemo(() => {
    const query = categoryQuery.trim().toLowerCase()
    if (!query) return categoryOptions
    return categoryOptions.filter((category) => category.name.toLowerCase().includes(query))
  }, [categoryOptions, categoryQuery])
  const canAddCategoryFromQuery = categoryQuery.trim().length > 0
    && !categoryOptions.some((category) => category.name.trim().toLowerCase() === categoryQuery.trim().toLowerCase())
  const groupedItems = useMemo(() => {
    const groups: { category: string; items: (TemplateDraftItem & { index: number })[] }[] = []
    items.forEach((item, index) => {
      const category = item.category.trim() || '기타'
      const existing = groups.find((group) => group.category === category)
      if (existing) {
        existing.items.push({ ...item, index })
      } else {
        groups.push({ category, items: [{ ...item, index }] })
      }
    })
    return groups
  }, [items])

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
    setCategoryPickerOpen(false)
    setCategoryQuery('')
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
            <View style={styles.itemFormSection}>
              <Text style={styles.fieldLabel}>카테고리</Text>
              <Pressable
                onPress={() => setCategoryPickerOpen((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel={`카테고리 ${itemCategory} 선택`}
                style={({ pressed }) => [
                  styles.categoryTrigger,
                  categoryPickerOpen && styles.categoryTriggerActive,
                  pressed && styles.pressedFade,
                ]}
              >
                <View style={styles.categoryTriggerIcon}>
                  <Ionicons name="pricetag-outline" size={17} color={colors.brand.primary} />
                </View>
                <Text style={styles.categoryTriggerText} numberOfLines={1}>
                  {itemCategory || '카테고리 선택'}
                </Text>
                <Ionicons name={categoryPickerOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.brand.muted} />
              </Pressable>

              {categoryPickerOpen ? (
                <View style={styles.categoryPickerPanel}>
                  <View style={styles.categorySearchBox}>
                    <Ionicons name="search-outline" size={16} color={colors.brand.muted} />
                    <TextInput
                      value={categoryQuery}
                      onChangeText={setCategoryQuery}
                      placeholder="카테고리 검색 또는 직접 입력"
                      placeholderTextColor={colors.brand.mutedSoft}
                      style={styles.categorySearchInput}
                    />
                  </View>
                  {canAddCategoryFromQuery ? (
                    <Pressable
                      onPress={() => {
                        setItemCategory(categoryQuery.trim())
                        setCategoryPickerOpen(false)
                        setCategoryQuery('')
                      }}
                      style={({ pressed }) => [styles.categoryOptionRow, styles.categoryAddRow, pressed && styles.pressedFade]}
                    >
                      <Text style={[styles.categoryOptionText, styles.categoryAddText]}>+ “{categoryQuery.trim()}”로 추가</Text>
                    </Pressable>
                  ) : null}
                  <ScrollView
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={filteredCategoryOptions.length > 5}
                    keyboardShouldPersistTaps="handled"
                    style={styles.categoryOptionScroll}
                    contentContainerStyle={styles.categoryOptionList}
                  >
                    {filteredCategoryOptions.map((category) => {
                      const selected = itemCategory === category.name
                      return (
                        <Pressable
                          key={category.id}
                          onPress={() => {
                            setItemCategory(category.name)
                            setCategoryPickerOpen(false)
                            setCategoryQuery('')
                          }}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: selected }}
                          style={({ pressed }) => [
                            styles.categoryOptionRow,
                            selected && styles.categoryOptionRowActive,
                            pressed && styles.pressedFade,
                          ]}
                        >
                          <Text style={[styles.categoryOptionText, selected && styles.categoryOptionTextActive]}>
                            {category.name}
                          </Text>
                          <Ionicons
                            name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                            size={20}
                            color={selected ? colors.brand.primary : colors.brand.mutedSoft}
                          />
                        </Pressable>
                      )
                    })}
                  </ScrollView>
                </View>
              ) : null}
            </View>
            <Pressable
              onPress={() => setItemPrivate((prev) => !prev)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: itemPrivate }}
              style={({ pressed }) => [styles.privateToggle, pressed && styles.pressedFade]}
            >
              <View style={styles.privateToggleIcon}>
                <Ionicons
                  name={itemPrivate ? 'lock-closed' : 'lock-open-outline'}
                  size={17}
                  color={itemPrivate ? colors.brand.primary : colors.brand.muted}
                />
              </View>
              <View style={styles.privateToggleBody}>
                <Text style={[styles.privateToggleText, itemPrivate && styles.privateToggleTextActive]}>
                  비공개 항목
                </Text>
                <Text style={styles.privateToggleMeta}>
                  템플릿 적용 시 나만 볼 수 있는 개인 준비물로 추가돼요.
                </Text>
              </View>
              <Ionicons
                name={itemPrivate ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={itemPrivate ? colors.brand.primary : colors.brand.mutedSoft}
              />
            </Pressable>
          </View>

          {/* 항목 리스트 */}
          {items.length > 0 && (
            <View style={styles.itemList}>
              {groupedItems.map((group) => (
                <View key={group.category} style={styles.itemCategorySection}>
                  <View style={styles.itemCategoryHeader}>
                    <View style={styles.itemCategoryAccent} />
                    <Text style={styles.itemCategoryTitle} numberOfLines={1}>
                      {group.category}
                    </Text>
                    <View style={styles.itemCategoryCount}>
                      <Text style={styles.itemCategoryCountText}>{group.items.length}</Text>
                    </View>
                  </View>
                  <View style={styles.itemCategoryBody}>
                    {group.items.map((item) => (
                      <View key={item.id} style={styles.itemRow}>
                        <View style={styles.itemTextBlock}>
                          <View style={styles.itemTitleRow}>
                            <Text style={styles.itemText} numberOfLines={1}>
                              {item.item_name}
                            </Text>
                            {item.is_private ? (
                              <View style={styles.itemPrivateBadge}>
                                <Ionicons name="lock-closed" size={11} color={colors.brand.primary} />
                                <Text style={styles.itemPrivateBadgeText}>비공개</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                        <Pressable
                          onPress={() => handleRemoveItem(item.index)}
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
  itemFormSection: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  categoryTrigger: {
    minHeight: 56,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg.canvas,
  },
  categoryTriggerActive: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.bg.surfaceSoft,
  },
  categoryTriggerIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surfaceSoft,
  },
  categoryTriggerText: {
    flex: 1,
    minWidth: 0,
    color: colors.brand.ink,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
  },
  categoryPickerPanel: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.surfaceSoft,
  },
  categorySearchBox: {
    minHeight: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bg.canvas,
  },
  categorySearchInput: {
    flex: 1,
    minWidth: 0,
    color: colors.brand.ink,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
  },
  categoryOptionList: {
    gap: spacing.xs,
    paddingBottom: spacing.xxs,
  },
  categoryOptionScroll: {
    maxHeight: 240,
  },
  categoryOptionRow: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.bg.canvas,
  },
  categoryOptionRowActive: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.bg.surfaceSoft,
  },
  categoryOptionText: {
    flex: 1,
    color: colors.brand.ink,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
  },
  categoryOptionTextActive: {
    color: colors.brand.primary,
    fontWeight: fontWeights.bold,
  },
  categoryAddRow: {
    borderStyle: 'dashed',
    borderColor: colors.brand.primary,
  },
  categoryAddText: {
    color: colors.brand.primary,
    fontWeight: fontWeights.bold,
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
    minHeight: 64,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.bg.canvas,
  },
  privateToggleIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surfaceSoft,
  },
  privateToggleBody: {
    flex: 1,
    minWidth: 0,
  },
  privateToggleText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.brand.muted,
  },
  privateToggleTextActive: {
    color: colors.brand.primary,
  },
  privateToggleMeta: {
    marginTop: spacing.xxs,
    color: colors.brand.muted,
    fontSize: fontSizes.xs,
    lineHeight: 17,
  },
  // 항목 리스트
  itemList: {
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  itemListHeader: {
    minHeight: 56,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.bg.surfaceSoft,
  },
  itemListTitle: {
    flex: 1,
    color: colors.brand.ink,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
  },
  itemListCount: {
    minWidth: 28,
    height: 28,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.canvas,
  },
  itemListCountText: {
    color: colors.brand.primary,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
  },
  itemCategorySection: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.canvas,
  },
  itemCategoryHeader: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg.surfaceSoft,
  },
  itemCategoryAccent: {
    width: 4,
    height: 20,
    borderRadius: radii.full,
    backgroundColor: colors.brand.primary,
  },
  itemCategoryTitle: {
    flex: 1,
    minWidth: 0,
    color: colors.brand.ink,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  itemCategoryCount: {
    minWidth: 24,
    height: 24,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surfaceSoft,
  },
  itemCategoryCountText: {
    color: colors.brand.primary,
    fontSize: 11,
    fontWeight: fontWeights.bold,
  },
  itemCategoryBody: {
    paddingVertical: spacing.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.bg.canvas,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.sm,
    minHeight: 58,
  },
  itemText: {
    flex: 1,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.normal,
    color: colors.brand.ink,
  },
  itemTextBlock: { flex: 1 },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  itemPrivateBadge: {
    minHeight: 22,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.bg.surfaceSoft,
  },
  itemPrivateBadgeText: {
    color: colors.brand.primary,
    fontSize: 10,
    fontWeight: fontWeights.bold,
  },
  itemMetaRow: {
    marginTop: spacing.xxs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  itemMeta: {
    fontSize: fontSizes.xs,
    color: colors.brand.muted,
  },
  itemRemoveBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surfaceSoft,
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
