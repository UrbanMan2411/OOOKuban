/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Manrope', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          900: '#0A1F18',
          700: '#1F352B',
        },
        muted: '#6B7A72',
        green: {
          50:  '#EEF5F0',
          100: '#DDEBE2',
          200: '#BFD9C7',
          300: '#94C2A4',
          500: '#1FB061',
          600: '#16965A',
          700: '#10743F',
          800: '#0E5C32',
          900: '#0F3D2E',
          950: '#0A261C',
        },
        sage:   '#7BBF95',
        paper:  '#FBF6EC',
        paper2: '#F5F3E8',
        mist:   '#E8EDE6',
        line:   '#D7DDD8',
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
      backdropBlur: { xs: '2px' },
      keyframes: {
        rise: {
          from: { opacity: 0, transform: 'translateY(16px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
        breath: {
          '0%,100%': { transform: 'scale(1)', opacity: .6 },
          '50%':     { transform: 'scale(1.04)', opacity: .8 },
        },
      },
      animation: {
        rise: 'rise .6s cubic-bezier(.2,.9,.3,1.05) both',
        breath: 'breath 10s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
