import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { AuthorityConflictResolution } from '@nexvoy/core'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

interface AuthorityConflictModalProps {
  visible: boolean
  pendingCount: number
  resolving: boolean
  error: string | null
  bottomInset: number
  onClose: () => void
  onResolve: (resolution: AuthorityConflictResolution) => void
}

export function AuthorityConflictModal({
  visible,
  pendingCount,
  resolving,
  error,
  bottomInset,
  onClose,
  onResolve,
}: AuthorityConflictModalProps) {
  const close = () => {
    if (!resolving) onClose()
  }

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={close} statusBarTranslucent>
      <Pressable
        style={[styles.backdrop, { paddingBottom: Math.max(bottomInset, spacing.base) }]}
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="충돌 해결 창 닫기"
      >
        <View
          style={styles.dialog}
          accessibilityRole="alert"
          accessibilityViewIsModal
          onAccessibilityEscape={close}
          onStartShouldSetResponder={() => true}
        >
          <Pressable
            onPress={close}
            disabled={resolving}
            accessibilityRole="button"
            accessibilityLabel="닫기"
            hitSlop={12}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={22} color={colors.brand.muted} />
          </Pressable>

          <Text style={styles.title}>변경 사항을 선택해 주세요</Text>
          <Text style={styles.description}>
            다른 기기에서 같은 항목이 먼저 수정되었습니다. 서버의 최신 내용과 이 기기의 변경 중 하나를 선택해야 합니다.
          </Text>
          <Text style={styles.pending}>이 기기에서 대기 중인 변경 {pendingCount}건</Text>

          {error ? (
            <View style={styles.errorBox} accessibilityLiveRegion="polite">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={() => onResolve('keep_server')}
              disabled={resolving}
              accessibilityRole="button"
              accessibilityLabel="서버 최신 내용 사용"
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, resolving && styles.disabled]}
            >
              {resolving ? (
                <ActivityIndicator size="small" color={colors.bg.canvas} />
              ) : (
                <Ionicons name="cloud-download-outline" size={19} color={colors.bg.canvas} />
              )}
              <Text style={styles.primaryText}>서버 최신 내용 사용</Text>
            </Pressable>
            <Pressable
              onPress={() => onResolve('retry_local')}
              disabled={resolving}
              accessibilityRole="button"
              accessibilityLabel="이 기기 변경 다시 적용"
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed, resolving && styles.disabled]}
            >
              <Ionicons name="refresh-outline" size={19} color={colors.brand.ink} />
              <Text style={styles.secondaryText}>이 기기 변경 다시 적용</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    backgroundColor: 'rgba(15, 23, 42, 0.48)',
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    padding: spacing.lg,
    borderRadius: radii.md,
    backgroundColor: colors.bg.canvas,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    zIndex: 1,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  title: {
    paddingRight: spacing.xl,
    color: colors.brand.ink,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    lineHeight: 28,
  },
  description: {
    marginTop: spacing.sm,
    color: colors.brand.muted,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    lineHeight: 21,
  },
  pending: {
    marginTop: spacing.md,
    color: colors.brand.ink,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  errorBox: {
    marginTop: spacing.base,
    padding: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: '#FEF2F2',
  },
  errorText: {
    color: colors.brand.error,
    fontSize: fontSizes.sm,
    lineHeight: 19,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  primaryButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.brand.primary,
  },
  primaryText: {
    color: colors.bg.canvas,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  secondaryButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    borderRadius: radii.sm,
    backgroundColor: colors.bg.canvas,
  },
  secondaryText: {
    color: colors.brand.ink,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.62,
  },
})
