/**
 * 오픈소스 라이선스 화면 (nexvoy-app)
 *
 * 주요 의존 라이브러리의 라이선스 정보를 정적 배열로 표시한다.
 * 검색 필터 + 탭하여 인라인으로 라이선스 전문(요약) 확장.
 * 외부 데이터/네트워크 없이 순수 정적 화면.
 */
import { useMemo, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { colors, fontSizes, fontWeights, radii, spacing } from '@/theme'

interface LicenseEntry {
  name: string
  version: string
  license: string
  url: string
}

const LICENSES: LicenseEntry[] = [
  {
    name: 'React',
    version: '18.x',
    license: 'MIT',
    url: 'https://github.com/facebook/react',
  },
  {
    name: 'React Native',
    version: '0.7x',
    license: 'MIT',
    url: 'https://github.com/facebook/react-native',
  },
  {
    name: 'Expo',
    version: 'SDK 5x',
    license: 'MIT',
    url: 'https://github.com/expo/expo',
  },
  {
    name: 'Expo Router',
    version: '3.x',
    license: 'MIT',
    url: 'https://github.com/expo/router',
  },
  {
    name: 'Supabase JS',
    version: '2.x',
    license: 'MIT',
    url: 'https://github.com/supabase/supabase-js',
  },
  {
    name: 'react-native-safe-area-context',
    version: '4.x',
    license: 'MIT',
    url: 'https://github.com/th3rdwave/react-native-safe-area-context',
  },
  {
    name: '@expo/vector-icons',
    version: '14.x',
    license: 'MIT',
    url: 'https://github.com/expo/vector-icons',
  },
  {
    name: 'date-fns',
    version: '3.x',
    license: 'MIT',
    url: 'https://github.com/date-fns/date-fns',
  },
  {
    name: 'TypeScript',
    version: '5.x',
    license: 'Apache-2.0',
    url: 'https://github.com/microsoft/TypeScript',
  },
  {
    name: 'Zustand',
    version: '4.x',
    license: 'MIT',
    url: 'https://github.com/pmndrs/zustand',
  },
]

const LICENSE_SUMMARY: Record<string, string> = {
  MIT: 'MIT License — 누구나 무료로 사용·복제·수정·배포·판매할 수 있으며, 소프트웨어의 모든 사본에 저작권 고지와 라이선스 고지를 포함해야 합니다. 소프트웨어는 어떠한 보증 없이 "있는 그대로" 제공됩니다.',
  'Apache-2.0':
    'Apache License 2.0 — 사용·복제·수정·배포가 허용되며 특허권 라이선스를 명시적으로 부여합니다. 변경 사항 고지와 NOTICE 파일 유지가 요구되며, 소프트웨어는 보증 없이 "있는 그대로" 제공됩니다.',
}

export default function LicensesScreen() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return LICENSES
    return LICENSES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.license.toLowerCase().includes(q)
    )
  }, [query])

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressedFade]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.brand.ink} />
        </Pressable>
        <Text style={styles.headerTitle} accessibilityRole="header">
          오픈소스 라이선스
        </Text>
        <View style={styles.headerRight} />
      </View>

      {/* 검색 */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <Ionicons
            name="search-outline"
            size={18}
            color={colors.brand.mutedSoft}
          />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="라이브러리 검색"
            placeholderTextColor={colors.brand.mutedSoft}
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="라이브러리 검색"
            returnKeyType="search"
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>검색 결과가 없어요</Text>
          </View>
        ) : (
          filtered.map((entry) => {
            const isOpen = expanded === entry.name
            return (
              <Pressable
                key={entry.name}
                onPress={() => setExpanded(isOpen ? null : entry.name)}
                accessibilityRole="button"
                accessibilityLabel={`${entry.name} 라이선스 ${isOpen ? '닫기' : '열기'}`}
                style={({ pressed }) => [
                  styles.licenseRow,
                  pressed && styles.pressedFade,
                ]}
              >
                <View style={styles.licenseTop}>
                  <View style={styles.licenseInfo}>
                    <Text style={styles.licenseName} numberOfLines={1}>
                      {entry.name}
                    </Text>
                    <Text style={styles.licenseMeta}>
                      {entry.version} · {entry.license}
                    </Text>
                  </View>
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.brand.mutedSoft}
                  />
                </View>
                {isOpen && (
                  <View style={styles.licenseDetail}>
                    <Text style={styles.licenseText}>
                      {LICENSE_SUMMARY[entry.license] ??
                        `${entry.license} 라이선스에 따라 배포됩니다.`}
                    </Text>
                    <Text style={styles.licenseUrl} numberOfLines={1}>
                      {entry.url}
                    </Text>
                  </View>
                )}
              </Pressable>
            )
          })
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg.canvas },
  // 헤더
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.brand.border,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.brand.ink,
    textAlign: 'center',
  },
  headerRight: { width: 44, height: 44 },
  // 검색
  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.brand.hairline,
    backgroundColor: colors.bg.surfaceSoft,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSizes.base,
    color: colors.brand.ink,
    padding: 0,
  },
  body: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  // 라이선스 행
  licenseRow: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.brand.border,
    backgroundColor: colors.bg.canvas,
    padding: spacing.base,
  },
  licenseTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  licenseInfo: { flex: 1, gap: spacing.xxs },
  licenseName: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    color: colors.brand.ink,
  },
  licenseMeta: {
    fontSize: fontSizes.sm,
    color: colors.brand.muted,
  },
  licenseDetail: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.brand.hairlineSoft,
    gap: spacing.sm,
  },
  licenseText: {
    fontSize: fontSizes.sm,
    lineHeight: 20,
    color: colors.brand.body,
  },
  licenseUrl: {
    fontSize: fontSizes.xs,
    color: colors.brand.primary,
  },
  // 빈 상태
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    fontSize: fontSizes.base,
    color: colors.brand.muted,
  },
  pressedFade: { opacity: 0.6 },
})
