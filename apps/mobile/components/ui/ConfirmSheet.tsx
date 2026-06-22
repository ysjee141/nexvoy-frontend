import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Button } from './Button'
import { BottomSheet } from './BottomSheet'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

interface ConfirmSheetProps {
  visible: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = '취소',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  return (
    <BottomSheet visible={visible} title={title} onClose={onCancel}>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.actions}>
        <Button label={cancelLabel} variant="secondary" onPress={onCancel} />
        {destructive ? (
          <Pressable
            onPress={onConfirm}
            accessibilityRole="button"
            accessibilityLabel={confirmLabel}
            style={({ pressed }) => [
              styles.destructiveButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.destructiveText}>{confirmLabel}</Text>
          </Pressable>
        ) : (
          <Button label={confirmLabel} variant="primary" onPress={onConfirm} />
        )}
      </View>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  message: {
    color: colors.brand.body,
    fontSize: fontSizes.md,
    lineHeight: 22,
    fontWeight: fontWeights.medium,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  destructiveButton: {
    minHeight: 48,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.error,
  },
  destructiveText: {
    color: colors.bg.canvas,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
})
