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
            primary: { value: '#2EC4B6' },   // primary-mint
            primaryDark: { value: '#249E93' }, 
            secondary: { value: '#2C3A47' }, // text-primary (Deep Slate)
            muted: { value: '#828D99' },     // text-secondary (Soft Cool Gray)
            light: { value: '#FBFBF9' },     // bg-base
            border: { value: '#EEEEEE' },
            accent: { value: '#FF9F87' },    // accent-peach
          },
          bg: {
            surface: { value: '#FFFFFF' },
            card: { value: '#FFFFFF' },
            input: { value: '#FFFFFF' },
            light: { value: '#FBFBF9' },
            softCotton: { value: '#FBFBF9' },
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
