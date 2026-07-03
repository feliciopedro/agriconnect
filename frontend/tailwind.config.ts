import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2D6A4F',
          light: '#EAF4EE',
          hover: '#235A41',
          active: '#1B4532',
        },
        gold: {
          DEFAULT: '#C8960C',
          bg: '#FEF9EC',
        },
        amber: {
          DEFAULT: '#D97706',
          bg: '#FFFBEB',
        },
        red: {
          DEFAULT: '#DC2626',
          bg: '#FEF2F2',
        },
        blue: {
          DEFAULT: '#2563EB',
          bg: '#EFF6FF',
        },
        border: {
          DEFAULT: '#E5E7EB',
          focus: '#2D6A4F',
          input: '#D1D5DB',
        },
        text: {
          primary: '#111827',
          secondary: '#6B7280',
          muted: '#9CA3AF',
        },
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        card: '10px',
        btn: '8px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 1px 4px rgba(0,0,0,0.06)',
        'card-hover': '0 2px 8px rgba(45,106,79,0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
