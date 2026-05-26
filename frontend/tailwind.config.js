/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta de colores nocturna optimizada para visualización en la calle
        night: {
          950: '#0B0D13', // Fondo ultra oscuro
          900: '#111420', // Tarjetas y paneles
          800: '#1B1F32', // Bordes e inputs
          700: '#2A304D',
          600: '#3D456C'
        },
        ucb: {
          blue: '#003366',  // Color institucional UCB
          gold: '#D4AF37',  // Dorado institucional
          lightBlue: '#1E90FF'
        },
        panic: {
          DEFAULT: '#EF4444',
          hover: '#DC2626',
          glow: 'rgba(239, 68, 68, 0.4)'
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-red': '0 0 15px 5px rgba(239, 68, 68, 0.3)',
        'glow-blue': '0 0 15px 5px rgba(30, 144, 255, 0.2)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ripple': 'ripple 1.5s linear infinite'
      },
      keyframes: {
        ripple: {
          '0%': { transform: 'scale(1)', opacity: '0.8' },
          '100%': { transform: 'scale(2.5)', opacity: '0' }
        }
      }
    },
  },
  plugins: [],
}
