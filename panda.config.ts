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
            primary: { value: '#FF385C' }, // Airbnb Red-ish
            secondary: { value: '#222222' },
            accent: { value: '#008489' },
            success: { value: '#484848' },
            error: { value: '#C13515' },
          },
          bg: {
            surface: { value: '#FFFFFF' },
            card: { value: '#FFFFFF' },
            input: { value: '#F7F7F7' },
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
