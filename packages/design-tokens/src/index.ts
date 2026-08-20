/**
 * 갈래 디자인 토큰 (플랫폼 무관 순수 TS 객체)
 *
 * - 색상: HEX 문자열
 * - 치수(radii/spacing/fontSizes): 숫자 (단위 없음)
 *   웹(Panda)에서는 `${value}px`로 사용, RN에서는 숫자 그대로 사용
 * - fontWeights: 문자열 (CSS / RN 공통)
 * - shadows: 플랫폼별 표현이 다르므로 웹 전용 CSS box-shadow 문자열
 */

export const colors = {
  brand: {
    primary: '#0D2340',
    primaryActive: '#081A30',
    primaryDark: '#081A30',
    primaryDisabled: '#B8C4D2',
    accent: '#FF6B5C',
    secondary: '#1D2433',
    error: '#D92D20',
    errorHover: '#B42318',
    errorLight: '#FEF3F2',
    warning: '#F79009',
    ink: '#1D2433',
    body: '#344054',
    muted: '#667085',
    mutedSoft: '#98A2B3',
    hairline: '#D9DEEA',
    hairlineSoft: '#EEF1F6',
    border: '#D9DEEA',
    borderStrong: '#B8C1D1',
    success: '#12B76A',
  },
  bg: {
    canvas: '#FFFFFF',
    softCotton: '#FBF8F4',
    surfaceSoft: '#F7F8FC',
    surfaceStrong: '#F2F4F7',
    scrim: '#000000',
  },
} as const

export const radii = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 32,
  full: 9999,
} as const

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const

export const fontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
} as const

export const fontWeights = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const

export const shadows = {
  card: '0 2px 12px rgba(0,0,0,0.06)',
  modal: '0 20px 60px rgba(0,0,0,0.15)',
  fab: '0 4px 16px rgba(13,35,64,0.25)',
  nav: '0 -1px 0 #D9DEEA',
} as const
