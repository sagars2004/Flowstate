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
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        focus: {
          deep: '#10b981',    // Green for deep focus
          moderate: '#fbbf24', // Yellow for moderate focus
          distracted: '#ef4444', // Red for distracted
        }
      },
    },
  },
  plugins: [],
  darkMode: 'class',
};
