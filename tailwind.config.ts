import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Rose Gold + Ivory Palette
        primary: {
          DEFAULT: "#111111",
          50:  "#F8F8F8",
          100: "#F0F0F0",
          200: "#E0E0E0",
          300: "#C0C0C0",
          400: "#888888",
          500: "#444444",
          600: "#333333",
          700: "#222222",
          800: "#111111",
          900: "#0A0A0A",
          950: "#050505",
        },
        accent: {
          DEFAULT: "#555555",
          50:  "#F5F5F5",
          100: "#EBEBEB",
          200: "#D6D6D6",
          300: "#ADADAD",
          400: "#858585",
          500: "#555555",
          600: "#444444",
          700: "#333333",
          800: "#222222",
          900: "#111111",
        },
        ivory: {
          DEFAULT: "#FAFAFA",
          50:  "#FFFFFF",
          100: "#FAFAFA",
          200: "#F5F5F5",
          300: "#EBEBEB",
          400: "#E0E0E0",
          500: "#D4D4D4",
        },
        rose: {
          gold: "#111111",
          light: "#555555",
          pale: "#F0F0F0",
        },
        // Semantic colors  (variables are RGB channels, so use rgb() not hsl())
        background: "rgb(var(--background))",
        foreground: "rgb(var(--foreground))",
        card: {
          DEFAULT: "rgb(var(--card))",
          foreground: "rgb(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "rgb(var(--popover))",
          foreground: "rgb(var(--popover-foreground))",
        },
        muted: {
          DEFAULT: "rgb(var(--muted))",
          foreground: "rgb(var(--muted-foreground))",
        },
        border: "rgb(var(--border))",
        input: "rgb(var(--input))",
        ring: "rgb(var(--ring))",
        destructive: {
          DEFAULT: "rgb(var(--destructive))",
          foreground: "rgb(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "#10B981",
          foreground: "#FFFFFF",
        },
        warning: {
          DEFAULT: "#F59E0B",
          foreground: "#FFFFFF",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-playfair)", "Playfair Display", "Georgia", "serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      boxShadow: {
        soft: "0 2px 15px -3px rgba(183, 110, 121, 0.07), 0 10px 20px -2px rgba(183, 110, 121, 0.04)",
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.06)",
        "card-hover": "0 4px 6px -1px rgba(183, 110, 121, 0.1), 0 2px 4px -2px rgba(183, 110, 121, 0.06)",
        luxury: "0 20px 60px -10px rgba(183, 110, 121, 0.25)",
        glow: "0 0 20px rgba(183, 110, 121, 0.3)",
      },
      backgroundImage: {
        "rose-gradient": "linear-gradient(135deg, #B76E79 0%, #D4A0A7 50%, #C4956A 100%)",
        "ivory-gradient": "linear-gradient(180deg, #FFFFFF 0%, #FAFAF8 100%)",
        "card-gradient": "linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(250,250,248,0.7) 100%)",
        "sidebar-gradient": "linear-gradient(180deg, #2D1B1F 0%, #1A0F12 100%)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-in-out",
        "slide-in": "slideIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "pulse-soft": "pulseSoft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "shimmer": "shimmer 1.5s infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideIn: {
          "0%": { transform: "translateX(-10px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
