/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "outline-variant": "#D9DEE7",
        "inverse-primary": "#b0c8f1",
        "tertiary": "#0B2342",
        "on-background": "#0d1c2e",
        "secondary-container": "#fe932c",
        "inverse-on-surface": "#eaf1ff",
        "surface-container-lowest": "#ffffff",
        "surface-bright": "#F8FAFC",
        "on-surface-variant": "#44474e",
        "on-error": "#ffffff",
        "on-primary": "#ffffff",
        "on-secondary-container": "#8F4A00",
        "primary-fixed": "#d5e3ff",
        "outline": "#74777f",
        "secondary": "#A85B00",
        "surface-tint": "#485f83",
        "tertiary-fixed": "#dde1ff",
        "surface-container-high": "#DDE5EF",
        "surface-container-low": "#F1F5F9",
        "on-error-container": "#8C1616",
        "error": "#C62828",
        "surface-variant": "#D5DFEC",
        "surface": "#F8FAFC",
        "on-surface": "#0d1c2e",
        "surface-dim": "#CBD5E1",
        "secondary-fixed": "#ffdcc3",
        "secondary-fixed-dim": "#ffb77d",
        "background": "#F5F7FA",
        "tertiary-container": "#17365D",
        "on-primary-fixed": "#001b3b",
        "primary-container": "#102A4C",
        "primary": "#0B2342",
        "on-secondary": "#ffffff",
        "inverse-surface": "#233144",
        "surface-container-highest": "#D2DCE9",
        "error-container": "#ffdad6",
        "on-primary-container": "#7a91b7",
        "surface-container": "#E8EDF4",
        "primary-fixed-dim": "#b0c8f1",
        "success": "#16803A",
        "success-container": "#DCFCE7",
        "info": "#2563A8",
        "info-container": "#DBEAFE",
        "warning": "#B66A00",
        "warning-container": "#FEF3C7"
      },
      borderRadius: {
        sm: "0.125rem",
        DEFAULT: "0.25rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
        "2xl": "1rem",
        full: "9999px"
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"]
      },
      fontSize: {
        "headline-sm": ["18px", { lineHeight: "26px", fontWeight: "600" }],
        "headline-md": ["22px", { lineHeight: "30px", fontWeight: "600" }],
        "body-md": ["14px", { lineHeight: "22px", fontWeight: "400" }],
        "display-hero": ["40px", { lineHeight: "52px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg": ["30px", { lineHeight: "40px", letterSpacing: "-0.01em", fontWeight: "700" }],
        "body-lg": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-sm": ["13px", { lineHeight: "18px", fontWeight: "400" }],
        "label-md": ["13px", { lineHeight: "18px", letterSpacing: "0.01em", fontWeight: "600" }],
        "label-sm": ["11px", { lineHeight: "14px", letterSpacing: "0.03em", fontWeight: "600" }]
      },
      boxShadow: {
        card: "0 4px 12px -2px rgba(15, 41, 74, 0.08), 0 2px 6px -1px rgba(15, 41, 74, 0.04)",
        pop: "0 8px 24px -4px rgba(15, 41, 74, 0.16), 0 4px 10px -2px rgba(15, 41, 74, 0.08)"
      }
    }
  },
  plugins: []
};
