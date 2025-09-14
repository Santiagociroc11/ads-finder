/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        secondary: {
          50: '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0fe',
          300: '#f0abfc',
          400: '#e879f9',
          500: '#d946ef',
          600: '#c026d3',
          700: '#a21caf',
          800: '#86198f',
          900: '#701a75',
        },
        dark: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        }
      },
      fontFamily: {
        'orbitron': ['Orbitron', 'sans-serif'],
        'roboto': ['Roboto', 'sans-serif'],
      },
      animation: {
        'grid-move': 'moveGrid 20s linear infinite',
        'hot-pulse': 'hotPulse 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        moveGrid: {
          'from': { 'background-position': '0 0' },
          'to': { 'background-position': '-80px -80px' }
        },
        hotPulse: {
          '0%, 100%': { 'box-shadow': '0 0 20px rgba(251, 146, 60, 0.3)' },
          '50%': { 'box-shadow': '0 0 30px rgba(251, 146, 60, 0.5)' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' }
        }
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'holographic': '0 0 15px rgba(0, 255, 255, 0.1), 0 0 30px rgba(0, 255, 255, 0.05) inset',
        'neon': '0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor',
      }
    },
  },
  plugins: [],
  darkMode: 'class',
}
