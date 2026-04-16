import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        /* StreamMatch brand colors */
        background: "#0E0E10",
        surface: "#18181B",
        border: "#1F1F23",
        "twitch-purple": "#9146FF",
        "twitch-purple-hover": "#772CE8",

        /* League colors */
        "league-bronze": "#CD7F32",
        "league-silver": "#C0C0C0",
        "league-gold": "#FFD700",
        "league-platinum": "#E5E4E2",
      },
      borderRadius: {
        card: "16px",
      },
      maxWidth: {
        app: "1200px",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
