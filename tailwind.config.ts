import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        // cores de tema usadas pelos componentes de components/ui/ckex (botão, campo, selo)
        primary:     { DEFAULT: '#0284c7', foreground: '#ffffff' },
        secondary:   { DEFAULT: '#f1f5f9', foreground: '#1e293b' },
        destructive: { DEFAULT: '#dc2626', foreground: '#ffffff' },
        accent:      { DEFAULT: '#f1f5f9', foreground: '#0f172a' },
        muted:       { DEFAULT: '#f1f5f9', foreground: '#64748b' },
        card:        { DEFAULT: '#ffffff', foreground: '#1e293b' },
        background:  '#ffffff',
        foreground:  '#1e293b',
        input:       '#e2e8f0',
        ring:        '#0ea5e9',
        border:      '#e2e8f0',
        sidebar: {
          bg:     '#0a0f1e',
          border: '#1e2a3a',
          text:   '#94a3b8',
          active: '#e2e8f0',
          hover:  '#1e2a3a',
        },
        status: {
          ok:      '#10b981',
          ok_bg:   '#d1fae5',
          atencao: '#f59e0b',
          atencao_bg: '#fef3c7',
          perigo:  '#ef4444',
          perigo_bg: '#fee2e2',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)',
        'card-hover': '0 4px 12px 0 rgb(0 0 0 / 0.10)',
      },
    },
  },
  plugins: [],
}
export default config
