import type { ComponentProps, ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

export type DocumentKeyProvisioningStatus =
  | 'waiting_for_material'
  | 'pending'
  | 'processing'
  | 'failed'
  | 'completed'

export interface DocumentKeyProvisioningCopy {
  label: string
  title: string
  description: string
  actionLabel: string
}

export const DOCUMENT_KEY_PROVISIONING_COPY: Record<DocumentKeyProvisioningStatus, DocumentKeyProvisioningCopy> = {
  waiting_for_material: {
    label: '기기 준비 대기',
    title: '참여 기기 정보를 기다리고 있어요',
    description: '초대받은 사용자가 이 기기의 보안 정보를 등록하면 여정 데이터를 준비할 수 있습니다.',
    actionLabel: '상태 다시 확인',
  },
  pending: {
    label: '데이터 준비 대기',
    title: '여정 데이터를 안전하게 준비하고 있어요',
    description: '참여는 완료됐지만 아직 이 기기에서 여정 데이터를 열 수 없습니다. 관리자 또는 편집자가 준비를 완료하면 다시 시도할 수 있어요.',
    actionLabel: '준비 상태 다시 확인',
  },
  processing: {
    label: '데이터 준비 중',
    title: '여정 데이터를 준비하는 중이에요',
    description: '관리자 또는 편집자 기기에서 이 참여자가 여정을 열 수 있도록 준비하고 있습니다.',
    actionLabel: '처리 중',
  },
  failed: {
    label: '다시 시도 필요',
    title: '여정 데이터 준비가 지연되고 있어요',
    description: '일시적인 문제로 여정 데이터를 열 수 없습니다. 잠시 후 다시 시도하거나 관리자에게 준비 상태 확인을 요청해 주세요.',
    actionLabel: '다시 시도',
  },
  completed: {
    label: '데이터 준비 완료',
    title: '이 기기에서 여정 데이터를 열 수 있어요',
    description: '여정 데이터 준비가 완료되었습니다. 다시 불러오면 참여를 계속할 수 있습니다.',
    actionLabel: '여정 다시 열기',
  },
}

interface DocumentKeyProvisioningStatusBadgeProps {
  status: DocumentKeyProvisioningStatus
  count?: number
  style?: StyleProp<ViewStyle>
}

interface DocumentKeyProvisioningStatusCardProps {
  status: DocumentKeyProvisioningStatus
  memberName?: string | null
  errorCode?: string | null
  pendingCount?: number
  primaryActionLabel?: string
  primaryActionBusy?: boolean
  onPrimaryAction?: () => void
  footer?: ReactNode
  style?: StyleProp<ViewStyle>
}

type IoniconName = ComponentProps<typeof Ionicons>['name']

const STATUS_ICON: Record<DocumentKeyProvisioningStatus, IoniconName> = {
  waiting_for_material: 'key-outline',
  pending: 'time-outline',
  processing: 'sync-outline',
  failed: 'alert-circle-outline',
  completed: 'checkmark-circle-outline',
}

const STATUS_TONE: Record<
  DocumentKeyProvisioningStatus,
  { accent: string; badge: ViewStyle; badgeText: TextStyle; action: ViewStyle; actionText: TextStyle }
> = {
  waiting_for_material: {
    accent: colors.brand.muted,
    badge: { borderColor: colors.brand.hairline },
    badgeText: { color: colors.brand.muted },
    action: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
    actionText: { color: colors.bg.canvas },
  },
  pending: {
    accent: colors.brand.primary,
    badge: { borderColor: colors.brand.primary },
    badgeText: { color: colors.brand.primary },
    action: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
    actionText: { color: colors.bg.canvas },
  },
  processing: {
    accent: colors.brand.primary,
    badge: { borderColor: colors.brand.primary },
    badgeText: { color: colors.brand.primary },
    action: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
    actionText: { color: colors.bg.canvas },
  },
  failed: {
    accent: colors.brand.error,
    badge: { borderColor: colors.brand.error },
    badgeText: { color: colors.brand.error },
    action: { backgroundColor: colors.bg.canvas, borderColor: colors.brand.error },
    actionText: { color: colors.brand.error },
  },
  completed: {
    accent: colors.brand.success,
    badge: { borderColor: colors.brand.success },
    badgeText: { color: colors.brand.success },
    action: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
    actionText: { color: colors.bg.canvas },
  },
}

export function DocumentKeyProvisioningStatusBadge({
  status,
  count,
  style,
}: DocumentKeyProvisioningStatusBadgeProps) {
  const copy = DOCUMENT_KEY_PROVISIONING_COPY[status]
  const tone = STATUS_TONE[status]
  const text = typeof count === 'number' ? `${copy.label} ${count}건` : copy.label

  return (
    <View
      accessibilityLabel={text}
      style={[styles.badge, tone.badge, style]}
    >
      <Ionicons name={STATUS_ICON[status]} size={13} color={tone.accent} />
      <Text style={[styles.badgeText, tone.badgeText]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  )
}

export function DocumentKeyProvisioningStatusCard({
  status,
  memberName,
  errorCode,
  pendingCount,
  primaryActionLabel,
  primaryActionBusy = false,
  onPrimaryAction,
  footer,
  style,
}: DocumentKeyProvisioningStatusCardProps) {
  const copy = DOCUMENT_KEY_PROVISIONING_COPY[status]
  const tone = STATUS_TONE[status]
  const actionLabel = primaryActionLabel ?? copy.actionLabel
  const shouldDisableAction = primaryActionBusy || status === 'processing'

  return (
    <View
      accessibilityLiveRegion={status === 'completed' ? 'polite' : 'assertive'}
      style={[styles.card, style]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headingGroup}>
          <View style={styles.iconBox}>
            <Ionicons name={STATUS_ICON[status]} size={20} color={tone.accent} />
          </View>
          <View style={styles.headingTextGroup}>
            <Text style={styles.title} numberOfLines={2}>
              {memberName ? `${memberName}님 데이터 준비 상태` : copy.title}
            </Text>
            <Text style={styles.lead} numberOfLines={memberName ? 2 : undefined}>
              {memberName ? copy.title : copy.description}
            </Text>
          </View>
        </View>
        <DocumentKeyProvisioningStatusBadge status={status} count={pendingCount} />
      </View>

      {memberName ? <Text style={styles.description}>{copy.description}</Text> : null}

      {errorCode ? (
        <View style={styles.errorCodeBox}>
          <Text style={styles.errorCodeText}>준비가 지연되고 있어요. 잠시 후 다시 시도해 주세요.</Text>
        </View>
      ) : null}

      {onPrimaryAction ? (
        <Pressable
          onPress={onPrimaryAction}
          disabled={shouldDisableAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          accessibilityState={{ disabled: shouldDisableAction, busy: primaryActionBusy }}
          style={({ pressed }) => [
            styles.actionButton,
            tone.action,
            shouldDisableAction && styles.disabled,
            pressed && !shouldDisableAction && styles.pressed,
          ]}
        >
          {primaryActionBusy ? <ActivityIndicator color={tone.actionText.color} /> : null}
          <Text style={[styles.actionText, tone.actionText]}>{actionLabel}</Text>
        </Pressable>
      ) : null}

      {footer}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.base,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.canvas,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headingGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headingTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  iconBox: {
    width: 36,
    height: 36,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.surfaceSoft,
  },
  title: {
    color: colors.brand.ink,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    lineHeight: 21,
  },
  lead: {
    marginTop: spacing.xs,
    color: colors.brand.muted,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    lineHeight: 20,
  },
  description: {
    color: colors.brand.muted,
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
  badge: {
    minHeight: 24,
    maxWidth: 124,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    backgroundColor: colors.bg.surfaceSoft,
  },
  badgeText: {
    flexShrink: 1,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    lineHeight: 14,
  },
  errorCodeBox: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.bg.surfaceSoft,
  },
  errorCodeText: {
    color: colors.brand.muted,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    lineHeight: 16,
  },
  actionButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  actionText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
})
