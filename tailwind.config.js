/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class', // Enable class-based dark mode
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "#050505", // Deep space black
                primary: "#ffffff",
                secondary: "#888888",
                accent: "#3b82f6", // Blue from the logo references potentially? Or keeping it monochrome/metallic.
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            }
        },
    },
    plugins: [],
}
