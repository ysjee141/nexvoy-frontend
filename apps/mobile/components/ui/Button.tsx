/**
 * Button — 버튼 Atom (nexvoy-app)
 *
 * login `submitBtn`/`emailEntryBtn`, home `emptyCta` 의 사실상 표준을 컴포넌트화.
 *
 * - Pressable 기반 (TouchableOpacity 아님). pressed 시 opacity/scale 트랜스폼.
 * - variant: primary(채움) / secondary(테두리) / ghost(투명).
 * - loading 시 라벨 숨기고 ActivityIndicator + 터치 무효.
 * - 정적 스타일은 StyleSheet.create, variant/size/press/disabled 분기는 인라인 style 로 분리.
 * - a11y: accessibilityRole="button", accessibilityState={{ disabled, busy }}, 최소 44pt 터치.
 */
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps {
  label: string
  onPress: () => void
  /** 기본 'primary' */
  variant?: ButtonVariant
  /** 기본 'md' */
  size?: ButtonSize
  disabled?: boolean
  /** true → ActivityIndicator 표시, onPress 불가 */
  loading?: boolean
  /** 기본 true */
  fullWidth?: boolean
  accessibilityLabel?: string
}

const sizeStyles: Record<
  ButtonSize,
  { paddingVertical: number; paddingHorizontal: number; minHeight: number; fontSize: number }
> = {
  sm: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    minHeight: 44,
    fontSize: fontSizes.sm,
  },
  md: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    fontSize: fontSizes.base,
  },
  lg: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
    fontSize: fontSizes.base,
  },
}

const variantContainer: Record<ButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: colors.brand.primary,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.brand.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
}

const variantTextColor: Record<ButtonVariant, string> = {
  primary: colors.bg.canvas,
  secondary: colors.brand.primary,
  ghost: colors.brand.primary,
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = true,
  accessibilityLabel,
}: ButtonProps) {
  const isInactive = disabled || loading
  const sz = sizeStyles[size]

  // 동적 분기(variant/size/fullWidth)는 인라인 style 로 분리 (정적/동적 분리 원칙)
  const containerStyle: StyleProp<ViewStyle> = [
    styles.base,
    {
      paddingVertical: sz.paddingVertical,
      paddingHorizontal: sz.paddingHorizontal,
      minHeight: sz.minHeight,
      alignSelf: fullWidth ? 'stretch' : 'flex-start',
    },
    variantContainer[variant],
  ]

  const labelStyle: StyleProp<TextStyle> = [
    styles.label,
    { fontSize: sz.fontSize, color: variantTextColor[variant] },
  ]

  const indicatorColor =
    variant === 'primary' ? colors.bg.canvas : colors.brand.primary

  return (
    <Pressable
      onPress={onPress}
      disabled={isInactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      style={({ pressed }) => [
        containerStyle,
        pressed && !isInactive ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={indicatorColor} />
      ) : (
        <Text style={labelStyle} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  label: {
    fontWeight: fontWeights.bold,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
})
