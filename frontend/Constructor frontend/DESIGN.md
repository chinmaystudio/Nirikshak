---
name: National Infrastructure & Grievance Portal
colors:
  surface: '#f8f9ff'
  surface-dim: '#ccdbf3'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d5e3fc'
  on-surface: '#0d1c2e'
  on-surface-variant: '#44474e'
  inverse-surface: '#233144'
  inverse-on-surface: '#eaf1ff'
  outline: '#74777f'
  outline-variant: '#c4c6cf'
  surface-tint: '#485f83'
  primary: '#00142f'
  on-primary: '#ffffff'
  primary-container: '#0f294a'
  on-primary-container: '#7a91b7'
  inverse-primary: '#b0c8f1'
  secondary: '#904d00'
  on-secondary: '#ffffff'
  secondary-container: '#fe932c'
  on-secondary-container: '#663500'
  tertiary: '#000e42'
  on-tertiary: '#ffffff'
  tertiary-container: '#001f72'
  on-tertiary-container: '#6d88f9'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d5e3ff'
  primary-fixed-dim: '#b0c8f1'
  on-primary-fixed: '#001b3b'
  on-primary-fixed-variant: '#30476a'
  secondary-fixed: '#ffdcc3'
  secondary-fixed-dim: '#ffb77d'
  on-secondary-fixed: '#2f1500'
  on-secondary-fixed-variant: '#6e3900'
  tertiary-fixed: '#dde1ff'
  tertiary-fixed-dim: '#b8c4ff'
  on-tertiary-fixed: '#001453'
  on-tertiary-fixed-variant: '#173bab'
  background: '#f8f9ff'
  on-background: '#0d1c2e'
  surface-variant: '#d5e3fc'
typography:
  display-hero:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.02em
  display-hero-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 30px
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.03em
  utility-mono:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.25rem
  margin: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style
This design system defines an authoritative, civic-grade digital infrastructure environment tailored for Indian public governance, project transparency, and citizen grievance redressal. Drawing directly from established institutional touchstones such as Passport Seva, Digital India, and NIC frameworks, the visual philosophy centers on dignity, uncompromising accessibility, and sovereign credibility.

The design movement is **Corporate / Modern Institutional**, prioritizing high legibility, strict contrast ratios complying with GIGW 3.0 (Guidelines for Indian Government Websites) and WCAG 2.1 AA/AAA standards, and predictable spatial structures. Visual cues evoke national pride and administrative clarity through structured navy containers, saffron/gold accent highlights, warm ivory quick-action cards, crisp federal utility ribbons, and clear bilingual typography.

## Colors
The color architecture reflects solemn institutional authority balanced by approachable citizen service clarity:

- **Primary (`#0F294A`)**: Deep Sovereign Navy Blue used for the federal masthead, primary navigation, major action buttons, table headers, and structural anchors.
- **Secondary (`#D97706` / `#B45309`)**: National Saffron / Deep Amber gold, applied for action focus indicators, priority alerts, critical status badges, and warmth in quick-service feature tiles (`#FEF9EE` container tint with `#F59E0B` borders).
- **Tertiary (`#1E40AF`)**: Mid-tier Royal Blue for interactive links, progress indicators, breadcrumbs, and active navigation indicators.
- **Neutral (`#475569`)**: Balanced Slate for secondary labels, metadata strings, and standard body reading.
- **Base Canvas (`#FFFFFF` & `#F8FAFC`)**: Ultra-clean pure white card surfaces placed against subtle `#F1F5F9` slate-neutral architectural page foundations to preserve eye comfort during intensive administrative tasks.

## Typography
Typographic clarity is paramount. **Inter** serves as the universal system typeface across headlines, running body text, forms, and data matrices to ensure pristine cross-platform rendering across desktop monitors and budget mobile displays. For grievance IDs, tracking numbers, and transaction tokens, **JetBrains Mono** provides unmistakable zero/O and 1/I discrimination.

Font scaling features dedicated mobile roles (`display-hero-mobile` and `headline-lg-mobile`) to prevent awkward line breaks in regional Indian names and administrative designations. The portal natively accommodates standard governmental accessibility switches (A-, A, A+) by proportionally scaling all typography rem units upward without destroying tabular grid alignments.

## Layout & Spacing
The layout follows an orderly 12-column responsive fluid grid pinned to a maximum container width of `1280px` on desktop, centering governmental data cleanly while maintaining breathing room on ultra-wide screens.

- **Desktop (1024px and up)**: 12 columns, 20px gutters (`gutter: 1.25rem`), and generous 32px side margins. Grid supports multi-column dashboard layouts, dual-pane grievance case files, and filterable transparency tables.
- **Tablet (768px – 1023px)**: 8 columns, 16px gutters, 24px margins. Navigation condenses; utility headers remain horizontally pinned.
- **Mobile (below 768px)**: 4 columns, 12px gutters, 16px margins (`margin: 1rem`). Tables adopt horizontal swipe or transform into stacked inspection cards.

## Elevation & Depth
Elevation in this design system avoids heavy shadows and decorative glows in favor of crisp structural clarity:

1. **Surface Layering**: The primary foundation rests at `#F8FAFC`. Core panels, citizen workbenches, and data tables occupy `#FFFFFF` elevated planes with subtle borders (`1px solid #E2E8F0`).
2. **Ambient Contrast Shadows**: High-prominence components (such as modal dialogues, floating grievance submission drawers, or active dropdown menus) utilize a discreet, low-diffusion shadow: `0 4px 12px -2px rgba(15, 41, 74, 0.08), 0 2px 6px -1px rgba(15, 41, 74, 0.04)`.
3. **Tinted Quick-Link Elevation**: Service trigger cards utilize a gentle `#FEF9EE` to `#FEF3C7` subtle warmth with a delicate `#FDE68A` structural border, elevating essential services without visual clutter.

## Shapes
A disciplined **Soft (`roundedness: 1`)** geometry governs the UI. Standard buttons, inputs, tags, and table cells feature compact `4px` (`0.25rem`) rounded corners, conveying stability, official structure, and institutional permanence. 

Cards and container groupings use `8px` (`0.5rem`, `rounded-lg`) corner radii to maintain soft boundaries without looking playful or informal. Full pills are reserved exclusively for status indicators (e.g., "Resolved", "In Progress", "Escalated") to distinguish semantic alerts from clickable action blocks.

## Components

### Government Utility Top Bar & Header Masthead
- **Accessibility & Utility Ribbon**: Positioned at the very top (`#F1F5F9` background, `#334155` text). Features "Skip to Main Content", "Screen Reader Access", font size scale toggles (`A-`, `A`, `A+`), bilingual Hindi/English switch (`अ/A`), and Toll-Free National Grievance Call Center number (`1800-XXX-XXXX`) with telephone icon.
- **Official Brand Header**: Pure white `#FFFFFF` surface housing the National Emblem motif, Ministry branding text hierarchy ("Ministry of Housing & Urban Affairs / Government of India"), universal keyword search with inline magnifying glass, and dual utility buttons: Outline `Login` and Primary Navy `Register / Lodge Grievance`.

### Buttons
- **Primary**: Solid Navy (`#0F294A`) background, `#FFFFFF` text, `4px` border radius, `0.5rem 1.25rem` padding, subtle hover shift to `#1A365D`.
- **Secondary / Action**: Solid Saffron/Amber (`#D97706`) background, `#FFFFFF` text, hover to `#B45309`. Used for primary citizen calls to action ("Submit Complaint", "Track Status").
- **Outline / Administrative**: `#FFFFFF` background, `1.5px solid #0F294A`, `#0F294A` text, hover to `#F1F5F9`.

### Quick Link & Service Action Cards
- Highlight cards patterned after Passport Seva's service tiles: Soft warm amber-tinted background (`#FEF9EE`), border `1px solid #FDE68A`, compact `8px` radius.
- Contains an illustrated line/duotone vector icon in dark amber/navy, followed by bold service titles ("Track Public Works", "Lodge Grievance", "Check Ward Progress").

### Data Tables & Transparency Dashboards
- **Header**: Deep Navy `#0F294A` with white bold typography, or `#F8FAFC` slate header with dark text and explicit column sorting icons.
- **Rows**: Alternating white and `#F8FAFC` zebra striping, bordered by `#E2E8F0` dividers.
- **Status Badges**: Pill-shaped with strict color pairing:
  - *Resolved / Completed*: `#DCFCE7` background, `#166534` text.
  - *In Progress / Under Review*: `#FEF3C7` background, `#92400E` text.
  - *Escalated / Critical*: `#FEE2E2` background, `#991B1B` text.

### Form Fields & Grievance Inputs
- **Inputs**: White surface, `#0F294A` (when focused with a `2px` clear ring) or `#CBD5E1` resting border, explicit floating labels with mandatory red asterisk indicator (`#DC2626`).
- **File Uploaders**: Dedicated citizen document upload zones with GIGW-compliant guidance text specifying allowed PDF/JPG sizes.