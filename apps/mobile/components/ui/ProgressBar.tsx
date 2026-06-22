import { StyleSheet, Text, View, type DimensionValue } from 'react-native'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

interface ProgressBarProps {
  value: number
  label?: string
  showValue?: boolean
}

function clampPercent(value: number) {
  if (Number.isNaN(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

export function ProgressBar({ value, label, showValue = true }: ProgressBarProps) {
  const percent = clampPercent(value)

  return (
    <View>
      {(label || showValue) ? (
        <View style={styles.labelRow}>
          {label ? <Text style={styles.label}>{label}</Text> : <View />}
          {showValue ? <Text style={styles.value}>{percent}%</Text> : null}
        </View>
      ) : null}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` as DimensionValue }]} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.brand.muted,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
  },
  value: {
    color: colors.brand.primary,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
  },
  track: {
    height: 8,
    overflow: 'hidden',
    borderRadius: radii.full,
    backgroundColor: colors.brand.hairlineSoft,
  },
  fill: {
    height: '100%',
    borderRadius: radii.full,
    backgroundColor: colors.brand.primary,
  },
})
