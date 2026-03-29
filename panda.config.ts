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
            primary: { value: '#3B82F6' },
            secondary: { value: '#172554' },
            accent: { value: '#6366F1' },
            success: { value: '#10B981' },
            error: { value: '#EF4444' },
          },
          bg: {
            surface: { value: '#F8FAFF' },
            card: { value: 'rgba(255, 255, 255, 0.8)' },
          }
        },
        shadows: {
          premium: { value: '0 10px 30px -10px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' },
          glow: { value: '0 0 20px rgba(59, 130, 246, 0.15)' },
        }
      }
    },
  },

  // The output directory for your css system
  outdir: "styled-system",
});
