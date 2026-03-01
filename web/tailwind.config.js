/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bev: "#22c55e",
        phev: "#86efac",
        hev: "#fbbf24",
        gasolina: "#60a5fa",
        diesel: "#94a3b8",
        gas: "#f97316",
        otros: "#c084fc",
      },
    },
  },
  plugins: [],
};
