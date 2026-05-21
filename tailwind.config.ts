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
        'bg-primary': '#0a0a0a',
        'bg-surface': '#111111',
        'bg-elevated': '#1a1a1a',
        'accent-1': '#e8ff47',
        'accent-2': '#ff4b4b',
        'accent-3': '#a0a0a0',
        'text-primary': '#f0f0f0',
        'text-muted': '#555555',
        'border-default': '#222222',
        'border-accent': '#2d2d2d',
      },
      fontFamily: {
        mono: ['var(--font-space-mono)', 'monospace'],
        sans: ['var(--font-dm-sans)', 'sans-serif'],
        'geist-mono': ['var(--font-geist-mono)', 'monospace'],
      },
      letterSpacing: {
        wide: '0.08em',
        wider: '0.15em',
      },
    },
  },
  plugins: [],
};

export default config;
