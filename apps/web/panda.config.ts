import { defineConfig } from '@pandacss/dev'
import { colors, radii, spacing } from '@nexvoy/design-tokens'

export default defineConfig({
  preflight: true,

  include: ['./**/*.{js,jsx,ts,tsx}'],
  exclude: ['node_modules', '.next', 'styled-system'],

  theme: {
    extend: {
      tokens: {
        colors: {
          brand: {
            primary: { value: colors.brand.primary },
            primaryActive: { value: colors.brand.primaryActive },
            primaryDisabled: { value: colors.brand.primaryDisabled },
            error: { value: colors.brand.error },
            errorHover: { value: colors.brand.errorHover },
            ink: { value: colors.brand.ink },
            body: { value: colors.brand.body },
            muted: { value: colors.brand.muted },
            mutedSoft: { value: colors.brand.mutedSoft },
            hairline: { value: colors.brand.hairline },
            hairlineSoft: { value: colors.brand.hairlineSoft },
            border: { value: colors.brand.border },
            borderStrong: { value: colors.brand.borderStrong },
            success: { value: colors.brand.success },
          },
          bg: {
            canvas: { value: colors.bg.canvas },
            surfaceSoft: { value: colors.bg.surfaceSoft },
            surfaceStrong: { value: colors.bg.surfaceStrong },
            scrim: { value: colors.bg.scrim },
          },
        },
        radii: {
          none: { value: `${radii.none}px` },
          xs: { value: `${radii.xs}px` },
          sm: { value: `${radii.sm}px` },
          md: { value: `${radii.md}px` },
          lg: { value: `${radii.lg}px` },
          xl: { value: `${radii.xl}px` },
          full: { value: `${radii.full}px` },
        },
        spacing: {
          xxs: { value: `${spacing.xxs}px` },
          xs: { value: `${spacing.xs}px` },
          sm: { value: `${spacing.sm}px` },
          md: { value: `${spacing.md}px` },
          base: { value: `${spacing.base}px` },
          lg: { value: `${spacing.lg}px` },
          xl: { value: `${spacing.xl}px` },
          xxl: { value: `${spacing.xxl}px` },
          // 기존 panda 토큰 키(section) 유지 — 동일 값(64px)을 디자인 토큰 xxxl에서 매핑
          section: { value: `${spacing.xxxl}px` },
        },
        shadows: {
          airbnbHover: {
            value:
              'rgba(0,0,0,0.02) 0 0 0 1px, rgba(0,0,0,0.04) 0 2px 6px, rgba(0,0,0,0.1) 0 4px 8px',
          },
          'shadow.sm': { value: '0 1px 2px rgba(0,0,0,0.05)' },
          'shadow.md': { value: '0 4px 12px rgba(0,0,0,0.08)' },
          'shadow.primary': { value: '0 8px 20px rgba(37, 99, 235, 0.2)' },
        },
      },
    },
  },

  outdir: 'styled-system',
})
