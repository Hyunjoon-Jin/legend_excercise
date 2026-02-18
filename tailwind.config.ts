import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1e293b", // Slate 800 (Deep Navy)
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#f8fafc", // Slate 50 (Background)
          foreground: "#1e293b",
        },
        accent: {
          DEFAULT: "#d97706", // Amber 600 (Gold)
          foreground: "#ffffff",
        },
        background: "#f8fafc",
        surface: "#ffffff",
        muted: "#94a3b8", // Slate 400
        border: "#e2e8f0", // Slate 200
        success: "#059669",
        error: "#dc2626",
        wait: "#64748b",
      },
      fontFamily: {
        sans: ["Pretendard Variable", "Pretendard", "Inter", "sans-serif"],
      },
      borderRadius: {
        lg: "16px",
        md: "12px",
        sm: "8px",
      },
    },
  },
  plugins: [],
};
export default config;
