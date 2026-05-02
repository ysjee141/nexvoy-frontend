import { defineConfig } from "@pandacss/dev";

export default defineConfig({
  // Whether to use css reset
  preflight: true,

  // Where to look for your css declarations
  include: ["./src/**/*.{js,jsx,ts,tsx}", "./pages/**/*.{js,jsx,ts,tsx}"],

  // Files to exclude
  exclude: [],

  // Useful for theme customization
  theme: {
    extend: {
      tokens: {
        colors: {
          brand: {
            primary: { value: '#2563EB' },
            primaryActive: { value: '#1D4ED8' },
            primaryDisabled: { value: '#BFDBFE' },
            error: { value: '#EF4444' },
            errorHover: { value: '#DC2626' },
            ink: { value: '#1E293B' },
            body: { value: '#334155' },
            muted: { value: '#64748B' },
            mutedSoft: { value: '#94A3B8' },
            hairline: { value: '#E2E8F0' },
            hairlineSoft: { value: '#F1F5F9' },
            border: { value: '#E2E8F0' },
            borderStrong: { value: '#CBD5E1' },
            success: { value: '#10B981' },
          },
          bg: {
            canvas: { value: '#FFFFFF' },
            surfaceSoft: { value: '#F8FAFF' },
            surfaceStrong: { value: '#F1F5F9' },
            scrim: { value: '#000000' }
          }
        },
        radii: {
          none: { value: '0px' },
          xs: { value: '4px' },
          sm: { value: '8px' },
          md: { value: '14px' },
          lg: { value: '20px' },
          xl: { value: '32px' },
          full: { value: '9999px' },
        },
        spacing: {
          xxs: { value: '2px' },
          xs: { value: '4px' },
          sm: { value: '8px' },
          md: { value: '12px' },
          base: { value: '16px' },
          lg: { value: '24px' },
          xl: { value: '32px' },
          xxl: { value: '48px' },
          section: { value: '64px' },
        },
        shadows: {
          airbnbHover: { value: 'rgba(0,0,0,0.02) 0 0 0 1px, rgba(0,0,0,0.04) 0 2px 6px, rgba(0,0,0,0.1) 0 4px 8px' },
          'shadow.sm': { value: '0 1px 2px rgba(0,0,0,0.05)' },
          'shadow.md': { value: '0 4px 12px rgba(0,0,0,0.08)' },
          'shadow.primary': { value: '0 8px 20px rgba(37, 99, 235, 0.2)' },
        }
      }
    },
  },

  // The output directory for your css system
  outdir: "styled-system",
});
