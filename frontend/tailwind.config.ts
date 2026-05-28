import type { Config } from 'tailwindcss';

// Design tokens preserved from designer's original work.
// Friend's globals.css colors are mapped here so Tailwind utilities reach parity.
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#070b12',
        ink: '#e5edf8',
        muted: 'rgba(229, 237, 248, 0.62)',
        border: 'rgba(148, 163, 184, 0.12)',
        panel: 'rgba(15, 23, 42, 0.78)',
        'panel-strong': 'rgba(9, 14, 24, 0.92)',
        selection: '#8BCEFF',
        accent: {
          DEFAULT: '#7da2ff',
          blue: '#60a5fa',
        },
        risk: {
          'very-high': '#D34037',
          high: '#E6A14A',
          medium: '#EAE065',
          low: '#9ACA83',
          'very-low': '#80B971',
        },
      },
      fontFamily: {
        sans: ['Arial', '"Noto Sans KR"', '"Apple SD Gothic Neo"', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 36px rgba(96, 165, 250, 0.18)',
        'glow-strong': '0 0 48px rgba(96, 165, 250, 0.25)',
        panel: '0 18px 60px rgba(2, 6, 23, 0.55)',
      },
      borderRadius: {
        panel: '14px',
        chip: '999px',
      },
      letterSpacing: {
        wider: '0.02em',
        widest: '0.12em',
      },
    },
  },
  plugins: [],
};

export default config;
