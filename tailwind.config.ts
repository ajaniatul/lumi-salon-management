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
          DEFAULT: "#B76E79",  // Rose Gold
          50:  "#FCF5F6",
          100: "#F7E8EA",
          200: "#EDD0D4",
          300: "#DFACB2",
          400: "#CC8B92",
          500: "#B76E79",  // Main Rose Gold
          600: "#9A5563",
          700: "#80424F",
          800: "#693843",
          900: "#57313B",
          950: "#31181F",
        },
        accent: {
          DEFAULT: "#C4956A",  // Warm Gold accent
          50:  "#FBF6F0",
          100: "#F5E8D8",
          200: "#EACFB0",
          300: "#DCAF81",
          400: "#CE8E58",
          500: "#C4956A",
          600: "#A87A50",
          700: "#8B6242",
          800: "#724F37",
          900: "#5E4230",
        },
        ivory: {
          DEFAULT: "#FAFAF8",
          50:  "#FFFFFF",
          100: "#FAFAF8",
          200: "#F5F0EB",
          300: "#EDE5DC",
          400: "#E0D5C8",
          500: "#CFC0AE",
        },
        rose: {
          gold: "#B76E79",
          light: "#D4A0A7",
          pale: "#F2E0E2",
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
