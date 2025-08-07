/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./contexts/**/*.{js,jsx}",
    "./hooks/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1E40AF',    // blue
        secondary: '#111827',  // almost black
        accent: '#DC2626'      // red
      }
    },
  },
  plugins: [],
};
