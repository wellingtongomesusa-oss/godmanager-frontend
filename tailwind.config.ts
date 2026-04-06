import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /** Paleta explícita da página /login (spec) */
        login: {
          gold: '#C9A961',
          cream: '#F5F1EA',
          navy: '#0A1628',
          muted: '#6B7280',
        },
        gm: {
          sand: '#f8f6f2',
          cream: '#edeae4',
          paper: '#ffffff',
          ink: {
            DEFAULT: '#1a1a1c',
            secondary: '#4a4540',
            tertiary: '#8a8580',
          },
          amber: {
            DEFAULT: '#c9a96e',
            bg: '#f5ead8',
            bd: '#e5e0d6',
            light: '#dfc08a',
          },
          border: {
            DEFAULT: '#e2ddd4',
            strong: '#d4cec4',
          },
          sidebar: '#141416',
          green: {
            DEFAULT: '#2a6e4e',
            bg: '#e5f4ed',
          },
          red: {
            DEFAULT: '#b83030',
            bg: '#fce8e8',
          },
          blue: {
            DEFAULT: '#22558c',
            bg: '#e4eef8',
          },
          slate: {
            DEFAULT: '#4a5568',
            bg: '#edf0f4',
          },
        },
      },
      fontFamily: {
        heading: ['var(--font-cormorant)', 'Georgia', 'serif'],
        body: ['var(--font-dm)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
        playfair: ['var(--font-playfair)', 'Georgia', 'serif'],
        inter: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        gm: '12px',
        'gm-lg': '16px',
      },
      boxShadow: {
        'gm-card':
          '0 1px 3px rgba(26,26,28,.04), 0 4px 12px rgba(26,26,28,.03)',
        'gm-card-hover': '0 6px 24px rgba(26,26,28,.10)',
        'gm-amber': '0 2px 8px rgba(201,169,110,.25), 0 6px 20px rgba(201,169,110,.15)',
      },
      keyframes: {
        'gm-pulse': {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '0.85' },
        },
        'gm-fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'gm-scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'gm-slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'gm-toast-in': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'gm-pulse': 'gm-pulse 1.4s ease-in-out infinite',
        'gm-fade-in': 'gm-fade-in 300ms ease-out forwards',
        'gm-scale-in': 'gm-scale-in 200ms ease-out forwards',
        'gm-slide-in-right': 'gm-slide-in-right 300ms ease-out forwards',
        'gm-toast-in': 'gm-toast-in 280ms ease-out forwards',
      },
    },
  },
  plugins: [],
};

export default config;
