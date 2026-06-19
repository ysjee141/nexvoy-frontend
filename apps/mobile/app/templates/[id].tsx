/**
 * 템플릿 편집 화면 (nexvoy-app)
 *
 * new.tsx 와 동일한 폼 레이아웃을 사용하되, 진입 시 getTemplateWithItems 로
 * 초기 데이터를 로드해 제목/항목을 채운다.
 * 저장: updateTemplate(제목) + replaceTemplateItems(항목 전체 교체) → router.back().
 * 삭제: 헤더 우측 쓰레기통 → Alert 확인 → deleteTemplate → router.back().
 *
 * loading / notfound / form 3-상태 분기. category 는 빈 문자열로 저장(웹 동형).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
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
import {
  getTemplateWithItems,
  updateTemplate,
  replaceTemplateItems,
  deleteTemplate,
} from '@nexvoy/core'
import { supabase } from '@/lib/supabase'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

const TITLE_MAX = 50
const ITEM_MAX = 50

export default function EditTemplateScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [title, setTitle] = useState('')
  const [itemDraft, setItemDraft] = useState('')
  const [items, setItems] = useState<string[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isMounted = useRef(true)
  useEffect(() => () => { isMounted.current = false }, [])

  const loadTemplate = useCallback(async () => {
    if (!id) return
    setInitialLoading(true)
    try {
      const result = await getTemplateWithItems(supabase, id)
      if (!isMounted.current) return
      if (!result) {
        setNotFound(true)
        return
      }
      setTitle(result.template.title)
      setItems(result.items.map((it) => it.item_name))
    } catch {
      if (isMounted.current) setNotFound(true)
    } finally {
      if (isMounted.current) setInitialLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadTemplate()
  }, [loadTemplate])

  const trimmedDraft = itemDraft.trim()
  const canAddItem = trimmedDraft.length > 0
  const busy = saving || deleting
  const canSubmit = title.trim().length > 0 && !busy

  const handleAddItem = () => {
    if (!canAddItem) return
    setItems((prev) => [...prev, trimmedDraft])
    setItemDraft('')
  }

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!canSubmit || !id) return
    setSaving(true)
    setError(null)
    try {
      await updateTemplate(supabase, id, { title: title.trim() })
      await replaceTemplateItems(
        supabase,
        id,
        items.map((name) => ({ item_name: name, category: '' }))
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
      if (isMounted.current) setSaving(false)
    }
  }

  const handleDelete = () => {
    if (!id) return
    Alert.alert(
      '템플릿 삭제',
      '이 템플릿을 삭제할까요? 이 작업은 되돌릴 수 없어요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true)
            setError(null)
            try {
              await deleteTemplate(supabase, id)
              router.back()
            } catch (e) {
              if (isMounted.current) {
                setDeleting(false)
                setError(
                  e instanceof Error
                    ? e.message
                    : '템플릿 삭제에 실패했어요. 잠시 후 다시 시도해 주세요.'
                )
              }
            }
          },
        },
      ]
    )
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
          템플릿 편집
        </Text>
        {notFound ? (
          <View style={styles.headerRight} />
        ) : (
          <Pressable
            onPress={handleDelete}
            disabled={busy || initialLoading}
            accessibilityRole="button"
            accessibilityLabel="템플릿 삭제"
            accessibilityState={{ disabled: busy || initialLoading }}
            hitSlop={12}
            style={({ pressed }) => [
              styles.headerRight,
              pressed && styles.pressedFade,
            ]}
          >
            <Ionicons name="trash-outline" size={22} color={colors.brand.error} />
          </Pressable>
        )}
      </View>

      {initialLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.brand.primary} />
        </View>
      ) : notFound ? (
        <View style={styles.centerFill}>
          <Text style={styles.notFoundText}>
            템플릿을 찾을 수 없어요.
          </Text>
        </View>
      ) : (
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
            </View>

            {/* 항목 리스트 */}
            {items.length > 0 && (
              <View style={styles.itemList}>
                {items.map((name, index) => (
                  <View key={`${name}-${index}`} style={styles.itemRow}>
                    <Text style={styles.itemText} numberOfLines={1}>
                      {name}
                    </Text>
                    <Pressable
                      onPress={() => handleRemoveItem(index)}
                      accessibilityRole="button"
                      accessibilityLabel={`${name} 항목 삭제`}
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
              accessibilityLabel="변경 사항 저장"
              accessibilityState={{ disabled: !canSubmit }}
              style={({ pressed }) => [
                styles.submitBtn,
                pressed && canSubmit && styles.pressedSoft,
                !canSubmit && styles.submitBtnDisabled,
              ]}
            >
              {saving ? (
                <ActivityIndicator color={colors.bg.canvas} />
              ) : (
                <Text style={styles.submitBtnText}>변경 사항 저장</Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg.canvas },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: {
    fontSize: fontSizes.md,
    color: colors.brand.muted,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
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
