import type { ReactNode } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fontSizes, fontWeights, spacing } from '@/theme'

export interface SwipeAction {
  label: string
  icon: React.ComponentProps<typeof Ionicons>['name']
  color?: string
  onPress: () => void
}

interface SwipeRowProps {
  children: ReactNode
  actions: SwipeAction[]
  actionWidth?: number
}

export function SwipeRow({ children, actions, actionWidth = 76 }: SwipeRowProps) {
  const maxOpen = -Math.min(actions.length * actionWidth, 180)
  const [translateX] = useState(() => new Animated.Value(0))
  const [isOpen, setIsOpen] = useState(false)

  const settle = useCallback((toValue: number) => {
    setIsOpen(toValue !== 0)
    Animated.spring(translateX, {
      toValue,
      useNativeDriver: true,
      bounciness: 0,
      speed: 18,
    }).start()
  }, [translateX])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderMove: (_, gesture) => {
          const next = Math.max(maxOpen, Math.min(0, gesture.dx))
          translateX.setValue(next)
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx < -40) {
            settle(maxOpen)
          } else {
            settle(0)
          }
        },
        onPanResponderTerminate: () => settle(0),
      }),
    [maxOpen, settle, translateX]
  )

  return (
    <View style={styles.root}>
      <View
        style={styles.actions}
        importantForAccessibility={isOpen ? 'auto' : 'no-hide-descendants'}
        accessibilityElementsHidden={!isOpen}
      >
        {actions.map((action) => (
          <Pressable
            key={action.label}
            onPress={() => {
              settle(0)
              action.onPress()
            }}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={[
              styles.action,
              { width: actionWidth, backgroundColor: action.color ?? colors.brand.primary },
            ]}
          >
            <Ionicons name={action.icon} size={18} color={colors.bg.canvas} />
            <Text style={styles.actionText}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.content, { transform: [{ translateX }] }]}
      >
        {children}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    backgroundColor: colors.bg.canvas,
  },
  actions: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  actionText: {
    color: colors.bg.canvas,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
  },
  content: {
    backgroundColor: colors.bg.canvas,
  },
})
