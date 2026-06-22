import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

export interface SegmentedTab<T extends string> {
  key: T
  label: string
  icon?: React.ComponentProps<typeof Ionicons>['name']
}

interface SegmentedTabsProps<T extends string> {
  tabs: SegmentedTab<T>[]
  value: T
  onChange: (value: T) => void
}

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
}: SegmentedTabsProps<T>) {
  return (
    <View style={styles.root}>
      {tabs.map((tab) => {
        const selected = value === tab.key
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.tab,
              selected && styles.tabActive,
              pressed && styles.pressed,
            ]}
          >
            {tab.icon ? (
              <Ionicons
                name={tab.icon}
                size={16}
                color={selected ? colors.bg.canvas : colors.brand.muted}
              />
            ) : null}
            <Text style={[styles.tabText, selected && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.surfaceSoft,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    borderRadius: radii.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  tabActive: {
    backgroundColor: colors.brand.ink,
  },
  tabText: {
    color: colors.brand.muted,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  tabTextActive: {
    color: colors.bg.canvas,
  },
  pressed: {
    opacity: 0.85,
  },
})
