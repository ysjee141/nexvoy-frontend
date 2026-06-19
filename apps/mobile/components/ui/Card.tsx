/**
 * Card — 카드 컨테이너 Atom (nexvoy-app)
 *
 * home `tripCard`(canvas + 1px border + radius + shadows.card) 패턴을 추출.
 *
 * - onPress 가 있으면 Pressable, 없으면 View 로 렌더.
 * - elevated=true → RN 어댑터 `shadows.card` 스프레드(ADR-009: 문자열 shadow 직접 import 금지).
 * - 정적 스타일은 StyleSheet.create, padding/press 등 런타임 분기는 인라인 style 로 분리.
 */
import type { ReactNode } from 'react'
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { colors, radii, shadows, spacing } from '@/theme'

interface CardProps {
  children: ReactNode
  /** 있으면 Pressable, 없으면 View */
  onPress?: () => void
  /** true → shadows.card 적용, false(기본) → border만 */
  elevated?: boolean
  /** 기본 'md' */
  padding?: keyof typeof spacing
  style?: StyleProp<ViewStyle>
}

export function Card({
  children,
  onPress,
  elevated = false,
  padding = 'md',
  style,
}: CardProps) {
  // 동적 값(padding 토큰 선택, shadow 스프레드)은 인라인 style 로 분리
  const baseStyle: StyleProp<ViewStyle> = [
    styles.card,
    { padding: spacing[padding] },
    elevated ? shadows.card : null,
    style,
  ]

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [
          baseStyle,
          pressed ? styles.pressed : null,
        ]}
      >
        {children}
      </Pressable>
    )
  }

  return <View style={baseStyle}>{children}</View>
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.canvas,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.border,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
})
