/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        risenavy: {
          950: '#080B11',
          900: '#0D121D',
          850: '#121826',
          800: '#182132',
          700: '#222E44',
          600: '#334466',
        },
        pastel: {
          lavender: '#EDE8F8',
          lavenderDark: '#2B2342',
          lavenderText: '#6845B2',
          lavenderTextDark: '#D4C6F9',

          mint: '#E3F5EB',
          mintDark: '#193928',
          mintText: '#18824C',
          mintTextDark: '#A8EDC7',

          butter: '#FAF3D6',
          butterDark: '#3A3317',
          butterText: '#946E0D',
          butterTextDark: '#F7E298',

          sky: '#E1F1FD',
          skyDark: '#18344A',
          skyText: '#156FAE',
          skyTextDark: '#B1DEFD',

          rose: '#FCE7EB',
          roseDark: '#421E25',
          roseText: '#B92D4B',
          roseTextDark: '#FCA5B7'
        }
      },
      borderRadius: {
        '2xl': '18px',
        '3xl': '24px',
        '4xl': '32px',
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.04)',
        'card': '0 8px 30px -4px rgba(0, 0, 0, 0.05)',
        'modal': '0 20px 60px -10px rgba(0, 0, 0, 0.15)',
        'dark-soft': '0 4px 20px -2px rgba(0, 0, 0, 0.4)',
        'dark-glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'dark-glass-elevated': '0 16px 48px 0 rgba(0, 0, 0, 0.55)',
        'glow-blue': '0 0 25px -5px rgba(59, 130, 246, 0.4)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
