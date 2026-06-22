import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

interface EmptyStateProps {
  icon?: React.ComponentProps<typeof Ionicons>['name']
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  style?: StyleProp<ViewStyle>
}

export function EmptyState({
  icon = 'sparkles-outline',
  title,
  description,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  return (
    <View style={[styles.root, style]}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={36} color={colors.brand.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.surfaceSoft,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
    backgroundColor: colors.bg.canvas,
  },
  title: {
    color: colors.brand.ink,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    textAlign: 'center',
  },
  description: {
    marginTop: spacing.sm,
    color: colors.brand.muted,
    fontSize: fontSizes.md,
    lineHeight: 22,
    textAlign: 'center',
  },
  action: {
    minHeight: 48,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.primary,
  },
  actionText: {
    color: colors.bg.canvas,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.bold,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
})
