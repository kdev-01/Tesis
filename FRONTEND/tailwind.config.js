/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
        },
        surface: '#0f172a',
        'surface-light': '#f8fafc',
        foreground: '#0f172a',
        'foreground-dark': '#f8fafc',
        accent: '#22d3ee',
      },
      fontFamily: {
        display: ['\"Bebas Neue\"', 'system-ui', 'sans-serif'],
        body: ['\"Inter\"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        sporty: '0 20px 45px -15px rgba(244, 63, 94, 0.35)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
