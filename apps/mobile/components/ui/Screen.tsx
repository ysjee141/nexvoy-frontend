/**
 * Screen — 화면 래퍼 Layout primitive (nexvoy-app)
 *
 * 세 화면(login / home / checklist)이 공통으로 반복하던
 * `SafeAreaView + bg.canvas + edges + paddingHorizontal` 패턴을 컴포넌트로 추출.
 *
 * - 토큰은 `@/theme`에서만 import (design-tokens 직접 import 금지).
 * - 정적 스타일은 StyleSheet.create, 런타임 값(backgroundColor 등)은 인라인 style로 분리.
 * - scroll=true → ScrollView(폼/긴 콘텐츠), false(기본) → View.
 *   긴 목록(FlatList)은 scroll=false로 두고 자식에서 직접 렌더(스크롤 중첩 금지).
 */
import type { ReactNode } from 'react'
import {
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { SafeAreaView, type Edge } from 'react-native-safe-area-context'
import { colors, spacing } from '@/theme'

interface ScreenProps {
  children: ReactNode
  /** true → ScrollView, false(기본) → View */
  scroll?: boolean
  /** true(기본) → horizontal spacing.md 패딩 */
  padded?: boolean
  /** SafeAreaView edges, 기본 ['top'] */
  edges?: Edge[]
  /** 기본 colors.bg.canvas */
  backgroundColor?: string
  /** scroll=true 시 ScrollView contentContainerStyle 에 병합 전달 */
  contentContainerStyle?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle>
}

const DEFAULT_EDGES: Edge[] = ['top']

export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = DEFAULT_EDGES,
  backgroundColor = colors.bg.canvas,
  contentContainerStyle,
  style,
}: ScreenProps) {
  // 동적 값(backgroundColor)은 인라인 style 로 분리 (정적/동적 분리 원칙)
  const paddingStyle = padded ? styles.padded : null

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.root, { backgroundColor }, style]}
    >
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            paddingStyle,
            contentContainerStyle,
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, paddingStyle]}>{children}</View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  padded: {
    paddingHorizontal: spacing.md,
  },
})
