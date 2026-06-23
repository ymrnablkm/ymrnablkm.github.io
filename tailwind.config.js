/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#165DFF',
          dark: '#0D4ED8',
          light: '#4080FF',
        },
        accent: '#00B386',
        surface: {
          light: '#FFFFFF',
          card: '#F5F7FA',
          border: '#E5E6EB',
        },
        text: {
          primary: '#1D2129',
          secondary: '#4E5969',
          muted: '#86909C',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      maxWidth: {
        'content': '1200px',
      },
      borderRadius: {
        'card': '12px',
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 8px 24px rgba(0, 0, 0, 0.12)',
      },
      typography: {
        DEFAULT: {
          css: {
            lineHeight: '1.75',
            h1: { lineHeight: '1.3' },
            h2: { lineHeight: '1.3' },
            h3: { lineHeight: '1.4' },
          },
        },
      },
    },
  },
  plugins: [],
};