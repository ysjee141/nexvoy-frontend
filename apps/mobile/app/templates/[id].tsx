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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  getChecklistCategories,
  getTemplateWithItems,
  getTemplateShares,
  getProfileByEmail,
  shareTemplate,
  updateTemplateShareRole,
  removeTemplateShare,
  updateTemplate,
  replaceTemplateItems,
  deleteTemplate,
} from '@nexvoy/core'
import type { ChecklistCategory, ChecklistTemplateShareRole, ChecklistTemplateShareWithProfile } from '@nexvoy/types'
import { supabase } from '@/lib/supabase'
import { BottomSheet } from '@/components/ui'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

const TITLE_MAX = 50
const ITEM_MAX = 50
type TemplateDraftItem = {
  id: string
  item_name: string
  category: string
  is_private: boolean
}

export default function EditTemplateScreen() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  const [title, setTitle] = useState('')
  const [itemDraft, setItemDraft] = useState('')
  const [itemCategory, setItemCategory] = useState('기타')
  const [itemPrivate, setItemPrivate] = useState(false)
  const [items, setItems] = useState<TemplateDraftItem[]>([])
  const [categories, setCategories] = useState<ChecklistCategory[]>([])
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const [categoryQuery, setCategoryQuery] = useState('')
  const [initialLoading, setInitialLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [templateOwnerId, setTemplateOwnerId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [shareSheetOpen, setShareSheetOpen] = useState(false)
  const [shares, setShares] = useState<ChecklistTemplateShareWithProfile[]>([])
  const [sharesLoading, setSharesLoading] = useState(false)
  const isMounted = useRef(true)
  useEffect(() => () => { isMounted.current = false }, [])

  const loadShares = useCallback(async () => {
    if (!id) return
    setSharesLoading(true)
    try {
      const data = await getTemplateShares(supabase, id)
      if (isMounted.current) setShares(data)
    } catch {
      if (isMounted.current) setShares([])
    } finally {
      if (isMounted.current) setSharesLoading(false)
    }
  }, [id])

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
      setTemplateOwnerId(result.template.user_id)
      setItems(result.items.map((it) => ({
        id: it.id,
        item_name: it.item_name,
        category: it.category || '기타',
        is_private: it.is_private,
      })))
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id ?? null)
      if (user) setCategories(await getChecklistCategories(supabase, user.id))
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
  const canManageShares = Boolean(currentUserId && templateOwnerId === currentUserId)
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
    if (!canSubmit || !id) return
    setSaving(true)
    setError(null)
    try {
      await updateTemplate(supabase, id, { title: title.trim() })
      await replaceTemplateItems(
        supabase,
        id,
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

  const openShareSheet = () => {
    setShareSheetOpen(true)
    void loadShares()
  }

  const handleShareTemplate = async (email: string, role: ChecklistTemplateShareRole) => {
    if (!id || !currentUserId) return
    const profile = await getProfileByEmail(supabase, email)
    if (!profile) throw new Error('해당 이메일의 사용자를 찾을 수 없어요.')
    if (profile.id === currentUserId) throw new Error('내 계정에는 공유할 수 없어요.')
    await shareTemplate(supabase, {
      template_id: id,
      shared_with_user_id: profile.id,
      role,
      created_by: currentUserId,
    })
    await loadShares()
  }

  const handleUpdateShareRole = async (shareId: string, role: ChecklistTemplateShareRole) => {
    await updateTemplateShareRole(supabase, shareId, role)
    await loadShares()
  }

  const handleRemoveShare = async (shareId: string) => {
    await removeTemplateShare(supabase, shareId)
    await loadShares()
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
        {notFound || !canManageShares ? (
          <View style={styles.headerActions} />
        ) : (
          <View style={styles.headerActions}>
            <Pressable
              onPress={openShareSheet}
              disabled={busy || initialLoading}
              accessibilityRole="button"
              accessibilityLabel="템플릿 공유 관리"
              accessibilityState={{ disabled: busy || initialLoading }}
              hitSlop={12}
              style={({ pressed }) => [
                styles.headerActionButton,
                pressed && styles.pressedFade,
              ]}
            >
              <Ionicons name="share-social-outline" size={21} color={colors.brand.primary} />
            </Pressable>
            <Pressable
              onPress={handleDelete}
              disabled={busy || initialLoading}
              accessibilityRole="button"
              accessibilityLabel="템플릿 삭제"
              accessibilityState={{ disabled: busy || initialLoading }}
              hitSlop={12}
              style={({ pressed }) => [
                styles.headerActionButton,
                pressed && styles.pressedFade,
              ]}
            >
              <Ionicons name="trash-outline" size={22} color={colors.brand.error} />
            </Pressable>
          </View>
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
      <TemplateShareSheet
        visible={shareSheetOpen}
        shares={shares}
        loading={sharesLoading}
        onClose={() => setShareSheetOpen(false)}
        onShare={handleShareTemplate}
        onUpdateRole={handleUpdateShareRole}
        onRemove={handleRemoveShare}
      />
    </SafeAreaView>
  )
}

function getShareProfileLabel(share: ChecklistTemplateShareWithProfile): string {
  return share.profiles?.nickname?.trim()
    || share.profiles?.email?.trim()
    || '공유 사용자'
}

function getShareProfileMeta(share: ChecklistTemplateShareWithProfile): string {
  return share.profiles?.email?.trim() || '이메일 정보 없음'
}

function TemplateShareSheet({
  visible,
  shares,
  loading,
  onClose,
  onShare,
  onUpdateRole,
  onRemove,
}: {
  visible: boolean
  shares: ChecklistTemplateShareWithProfile[]
  loading: boolean
  onClose: () => void
  onShare: (email: string, role: ChecklistTemplateShareRole) => Promise<void>
  onUpdateRole: (shareId: string, role: ChecklistTemplateShareRole) => Promise<void>
  onRemove: (shareId: string) => Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<ChecklistTemplateShareRole>('viewer')
  const [submitting, setSubmitting] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) return
    setEmail('')
    setRole('viewer')
    setError('')
  }, [visible])

  const submit = async () => {
    const value = email.trim()
    if (!value) {
      setError('공유할 사용자의 이메일을 입력해 주세요.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onShare(value, role)
      setEmail('')
      setRole('viewer')
    } catch (e) {
      setError(e instanceof Error ? e.message : '템플릿 공유에 실패했어요.')
    } finally {
      setSubmitting(false)
    }
  }

  const updateRole = async (shareId: string, nextRole: ChecklistTemplateShareRole) => {
    setUpdatingId(shareId)
    setError('')
    try {
      await onUpdateRole(shareId, nextRole)
    } catch (e) {
      setError(e instanceof Error ? e.message : '권한 변경에 실패했어요.')
    } finally {
      setUpdatingId(null)
    }
  }

  const remove = async (shareId: string) => {
    setUpdatingId(shareId)
    setError('')
    try {
      await onRemove(shareId)
    } catch (e) {
      setError(e instanceof Error ? e.message : '공유 해제에 실패했어요.')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <BottomSheet visible={visible} title="템플릿 공유" onClose={onClose}>
      <View style={styles.shareIntroCard}>
        <View style={styles.shareIntroIcon}>
          <Ionicons name="people-outline" size={18} color={colors.brand.primary} />
        </View>
        <View style={styles.shareIntroBody}>
          <Text style={styles.shareIntroTitle}>사용자와 템플릿을 공유해요</Text>
          <Text style={styles.shareIntroText}>뷰어는 템플릿 사용만, 편집자는 템플릿 수정까지 할 수 있어요.</Text>
        </View>
      </View>

      <View style={styles.shareForm}>
        <Text style={styles.fieldLabel}>공유할 사용자</Text>
        <View style={styles.shareInputBox}>
          <Ionicons name="mail-outline" size={16} color={colors.brand.muted} />
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="friend@example.com"
            placeholderTextColor={colors.brand.mutedSoft}
            style={styles.shareInput}
          />
        </View>
        <View style={styles.shareRoleRow}>
          {[
            { key: 'viewer' as const, label: '뷰어', icon: 'eye-outline' as const },
            { key: 'editor' as const, label: '편집', icon: 'create-outline' as const },
          ].map((option) => {
            const selected = role === option.key
            return (
              <Pressable
                key={option.key}
                onPress={() => setRole(option.key)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                style={({ pressed }) => [
                  styles.shareRoleButton,
                  selected && styles.shareRoleButtonActive,
                  pressed && styles.pressedFade,
                ]}
              >
                <Ionicons
                  name={option.icon}
                  size={15}
                  color={selected ? colors.brand.primary : colors.brand.muted}
                />
                <Text style={[styles.shareRoleText, selected && styles.shareRoleTextActive]}>{option.label}</Text>
              </Pressable>
            )
          })}
        </View>
        <Pressable
          onPress={submit}
          disabled={submitting || !email.trim()}
          accessibilityRole="button"
          accessibilityState={{ disabled: submitting || !email.trim() }}
          style={({ pressed }) => [
            styles.shareSubmitButton,
            (submitting || !email.trim()) && styles.submitBtnDisabled,
            pressed && !submitting && email.trim().length > 0 && styles.pressedSoft,
          ]}
        >
          {submitting ? <ActivityIndicator color={colors.bg.canvas} /> : <Text style={styles.shareSubmitText}>공유 추가</Text>}
        </Pressable>
      </View>

      <View style={styles.shareListSection}>
        <View style={styles.shareListHeader}>
          <Text style={styles.shareListTitle}>공유 중인 사용자</Text>
          <View style={styles.shareListCount}>
            <Text style={styles.shareListCountText}>{shares.length}</Text>
          </View>
        </View>
        {loading ? (
          <View style={styles.shareLoading}>
            <ActivityIndicator color={colors.brand.primary} />
          </View>
        ) : shares.length === 0 ? (
          <Text style={styles.shareEmptyText}>아직 공유된 사용자가 없어요.</Text>
        ) : (
          <View style={styles.shareList}>
            {shares.map((share) => (
              <View key={share.id} style={styles.shareRow}>
                <View style={styles.shareAvatar}>
                  <Text style={styles.shareAvatarText}>{getShareProfileLabel(share).slice(0, 1)}</Text>
                </View>
                <View style={styles.shareRowBody}>
                  <Text style={styles.shareName} numberOfLines={1}>{getShareProfileLabel(share)}</Text>
                  <Text style={styles.shareMeta} numberOfLines={1}>{getShareProfileMeta(share)}</Text>
                  <View style={styles.shareInlineRoles}>
                    {(['viewer', 'editor'] as ChecklistTemplateShareRole[]).map((option) => {
                      const selected = share.role === option
                      return (
                        <Pressable
                          key={option}
                          onPress={() => updateRole(share.id, option)}
                          disabled={updatingId === share.id || selected}
                          style={({ pressed }) => [
                            styles.shareInlineRoleButton,
                            selected && styles.shareInlineRoleButtonActive,
                            pressed && !selected && styles.pressedFade,
                          ]}
                        >
                          <Text style={[styles.shareInlineRoleText, selected && styles.shareInlineRoleTextActive]}>
                            {option === 'viewer' ? '뷰어' : '편집'}
                          </Text>
                        </Pressable>
                      )
                    })}
                  </View>
                </View>
                <Pressable
                  onPress={() => remove(share.id)}
                  disabled={updatingId === share.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${getShareProfileLabel(share)} 공유 해제`}
                  style={({ pressed }) => [styles.shareRemoveButton, pressed && styles.pressedFade]}
                >
                  {updatingId === share.id ? (
                    <ActivityIndicator color={colors.brand.primary} />
                  ) : (
                    <Ionicons name="close" size={18} color={colors.brand.muted} />
                  )}
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </BottomSheet>
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
  headerActions: {
    width: 88,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  headerActionButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
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
  shareIntroCard: {
    minHeight: 72,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.bg.surfaceSoft,
  },
  shareIntroIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.canvas,
  },
  shareIntroBody: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  shareIntroTitle: {
    color: colors.brand.ink,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  shareIntroText: {
    color: colors.brand.muted,
    fontSize: fontSizes.xs,
    lineHeight: 17,
  },
  shareForm: {
    marginTop: spacing.base,
    gap: spacing.sm,
  },
  shareInputBox: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bg.canvas,
  },
  shareInput: {
    flex: 1,
    minWidth: 0,
    color: colors.brand.ink,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
  },
  shareRoleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  shareRoleButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bg.canvas,
  },
  shareRoleButtonActive: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.bg.surfaceSoft,
  },
  shareRoleText: {
    color: colors.brand.muted,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
  },
  shareRoleTextActive: {
    color: colors.brand.primary,
    fontWeight: fontWeights.bold,
  },
  shareSubmitButton: {
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.primary,
  },
  shareSubmitText: {
    color: colors.bg.canvas,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  shareListSection: {
    marginTop: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    overflow: 'hidden',
    backgroundColor: colors.bg.canvas,
  },
  shareListHeader: {
    minHeight: 50,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    backgroundColor: colors.bg.surfaceSoft,
  },
  shareListTitle: {
    flex: 1,
    color: colors.brand.ink,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  shareListCount: {
    minWidth: 24,
    height: 24,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.canvas,
  },
  shareListCountText: {
    color: colors.brand.primary,
    fontSize: 11,
    fontWeight: fontWeights.bold,
  },
  shareLoading: {
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareEmptyText: {
    padding: spacing.md,
    color: colors.brand.muted,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
  },
  shareList: {
    paddingVertical: spacing.xs,
  },
  shareRow: {
    minHeight: 82,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bg.canvas,
  },
  shareAvatar: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surfaceSoft,
  },
  shareAvatarText: {
    color: colors.brand.primary,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  shareRowBody: {
    flex: 1,
    minWidth: 0,
  },
  shareName: {
    color: colors.brand.ink,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  shareMeta: {
    marginTop: 2,
    color: colors.brand.muted,
    fontSize: fontSizes.xs,
  },
  shareInlineRoles: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  shareInlineRoleButton: {
    minHeight: 26,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.canvas,
  },
  shareInlineRoleButtonActive: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.bg.surfaceSoft,
  },
  shareInlineRoleText: {
    color: colors.brand.muted,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
  },
  shareInlineRoleTextActive: {
    color: colors.brand.primary,
    fontWeight: fontWeights.bold,
  },
  shareRemoveButton: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surfaceSoft,
  },
  // 인터랙션
  pressedSoft: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  pressedFade: { opacity: 0.6 },
})
