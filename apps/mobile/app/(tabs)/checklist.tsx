import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, fontSizes, fontWeights, spacing } from '@/theme'

export default function ChecklistScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>체크리스트</Text>
      </View>
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>☑️</Text>
        <Text style={styles.emptyTitle}>준비물이 없어요</Text>
        <Text style={styles.emptyDesc}>
          여행을 선택하면 준비물 목록이 여기에 표시됩니다.
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.brand.border,
  },
  title: {
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
    letterSpacing: -0.5,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.brand.ink,
  },
  emptyDesc: {
    fontSize: fontSizes.sm,
    color: colors.brand.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
})
