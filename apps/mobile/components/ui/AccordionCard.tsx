import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

interface AccordionCardProps {
  title: string
  subtitle?: string
  count?: number
  open: boolean
  onToggle: () => void
  children: ReactNode
}

export function AccordionCard({
  title,
  subtitle,
  count,
  open,
  onToggle,
  children,
}: AccordionCardProps) {
  return (
    <View style={styles.root}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {typeof count === 'number' ? (
          <View style={styles.countPill}>
            <Text style={styles.countText}>{count}</Text>
          </View>
        ) : null}
        <Ionicons
          name="chevron-down"
          size={18}
          color={colors.brand.muted}
          style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
        />
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.canvas,
  },
  header: {
    minHeight: 56,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: colors.brand.ink,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
  },
  subtitle: {
    marginTop: spacing.xxs,
    color: colors.brand.muted,
    fontSize: fontSizes.sm,
  },
  countPill: {
    minWidth: 28,
    height: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg.surfaceSoft,
  },
  countText: {
    color: colors.brand.primary,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  body: {
    borderTopWidth: 1,
    borderTopColor: colors.brand.hairlineSoft,
  },
})
