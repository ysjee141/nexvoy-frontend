import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { AuthorityProductSyncSnapshot } from '@nexvoy/core'
import { colors, fontSizes, spacing } from '@/theme'

interface AuthoritySyncStatusBadgeProps {
  snapshot: AuthorityProductSyncSnapshot
  onConflictPress?: () => void
}

const STATUS = {
  offline: { label: '오프라인 저장', icon: 'cloud-offline-outline', color: colors.brand.muted },
  pending: { label: '저장 대기', icon: 'time-outline', color: colors.brand.primary },
  synced: { label: '동기화 완료', icon: 'checkmark-circle-outline', color: colors.brand.success },
  conflict: { label: '충돌 확인 필요', icon: 'git-compare-outline', color: colors.brand.error },
  error: { label: '저장 오류', icon: 'alert-circle-outline', color: colors.brand.error },
} as const

export function AuthoritySyncStatusBadge({ snapshot, onConflictPress }: AuthoritySyncStatusBadgeProps) {
  const status = STATUS[snapshot.status]
  const pendingLabel = snapshot.pendingCount > 0 ? `, 대기 ${snapshot.pendingCount}건` : ''
  const content = (
    <>
      <Ionicons name={status.icon} size={14} color={status.color} />
      <Text style={[styles.label, { color: status.color }]} numberOfLines={1}>
        {status.label}
        {snapshot.status === 'conflict' && snapshot.pendingCount > 0 ? ` ${snapshot.pendingCount}건` : ''}
      </Text>
    </>
  )

  if (snapshot.status === 'conflict' && onConflictPress) {
    return (
      <Pressable
        onPress={onConflictPress}
        accessibilityRole="button"
        accessibilityLabel={`${status.label}${pendingLabel}. 해결 방법 선택`}
        style={({ pressed }) => [styles.container, styles.conflictButton, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    )
  }

  return (
    <View
      style={styles.container}
      accessibilityRole="text"
      accessibilityLabel={`${status.label}${pendingLabel}`}
    >
      {content}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 20,
  },
  label: {
    fontSize: fontSizes.xs,
  },
  conflictButton: {
    minHeight: 32,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  pressed: {
    opacity: 0.72,
  },
})
