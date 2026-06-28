import { ONVOY_TERMS_DOCUMENT } from '@nexvoy/core'
import { StyleSheet, Text, View } from 'react-native'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

export function TermsContent() {
  return (
    <View style={styles.container}>
      <Text style={styles.intro}>{ONVOY_TERMS_DOCUMENT.intro}</Text>

      {ONVOY_TERMS_DOCUMENT.sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.blocks.map((block, index) => {
            if (block.type === 'paragraph') {
              return (
                <Text key={`${section.title}-${index}`} style={styles.paragraph}>
                  {block.text}
                </Text>
              )
            }

            if (block.type === 'subheading') {
              return (
                <Text key={`${section.title}-${index}`} style={styles.subheading}>
                  {block.text}
                </Text>
              )
            }

            return (
              <View key={`${section.title}-${index}`} style={styles.list}>
                {block.items.map((item) => (
                  <View key={`${item.title ?? 'item'}-${item.text}`} style={styles.listItem}>
                    <Text style={styles.bullet}>{'\u2022'}</Text>
                    <Text style={styles.listText}>
                      {item.title ? (
                        <Text style={styles.listItemTitle}>{item.title}: </Text>
                      ) : null}
                      {item.text}
                    </Text>
                  </View>
                ))}
              </View>
            )
          })}
        </View>
      ))}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          <Text style={styles.footerLabel}>공고일자: </Text>
          {ONVOY_TERMS_DOCUMENT.footer.noticeDate}
        </Text>
        <Text style={styles.footerText}>
          <Text style={styles.footerLabel}>시행일자: </Text>
          {ONVOY_TERMS_DOCUMENT.footer.effectiveDate}
        </Text>
        <Text style={styles.footerText}>
          <Text style={styles.footerLabel}>이전 버전 확인: </Text>
          {ONVOY_TERMS_DOCUMENT.footer.previousVersion}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  intro: {
    fontSize: fontSizes.base,
    lineHeight: 24,
    fontWeight: fontWeights.semibold,
    color: colors.brand.ink,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    paddingLeft: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.brand.primary,
    fontSize: fontSizes.base,
    lineHeight: 24,
    fontWeight: fontWeights.bold,
    color: colors.brand.primary,
  },
  paragraph: {
    fontSize: fontSizes.sm,
    lineHeight: 22,
    color: colors.brand.body,
  },
  subheading: {
    marginTop: spacing.xs,
    fontSize: fontSizes.sm,
    lineHeight: 20,
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
  },
  list: {
    gap: spacing.xs,
  },
  listItem: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'flex-start',
  },
  bullet: {
    width: 12,
    fontSize: fontSizes.sm,
    lineHeight: 22,
    color: colors.brand.primary,
    fontWeight: fontWeights.bold,
  },
  listText: {
    flex: 1,
    fontSize: fontSizes.sm,
    lineHeight: 22,
    color: colors.brand.body,
  },
  listItemTitle: {
    color: colors.brand.ink,
    fontWeight: fontWeights.bold,
  },
  footer: {
    marginTop: spacing.lg,
    padding: spacing.base,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.border,
    backgroundColor: colors.bg.surfaceSoft,
    gap: spacing.xs,
  },
  footerText: {
    fontSize: fontSizes.xs,
    lineHeight: 18,
    color: colors.brand.muted,
  },
  footerLabel: {
    fontWeight: fontWeights.bold,
    color: colors.brand.ink,
  },
})
