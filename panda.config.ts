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
            primary: { value: '#2563EB' },   // primary-blue (Cobalt)
            primaryDark: { value: '#1D4ED8' }, 
            secondary: { value: '#1E293B' }, // text-primary (Deep Slate)
            muted: { value: '#64748B' },     // text-secondary (Cool Slate)
            light: { value: '#FFFFFF' },     // bg-base (Pure White)
            border: { value: '#E2E8F0' },    // Thin Blue Gray
            accent: { value: '#3B82F6' },    // accent-blue-light
            error: { value: '#EF4444' },
            errorLight: { value: '#FEF2F2' },
            success: { value: '#10B981' },
            warning: { value: '#F59E0B' },
          },
          bg: {
            surface: { value: '#FFFFFF' },
            card: { value: '#FFFFFF' },
            input: { value: '#FFFFFF' },
            light: { value: '#FFFFFF' },
            softCotton: { value: '#F8FAFF' }, // Very light blue tint for subtle grouping
            canvas: { value: '#FFFFFF' },
          }
        },
        shadows: {
          airbnb: { value: '0 6px 16px rgba(0,0,0,0.12)' },
          floating: { value: '0 12px 20px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.05)' },
          dimensional: { value: '0 1px 2px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.05)' },
        }
      }
    },
  },

  // The output directory for your css system
  outdir: "styled-system",
});
