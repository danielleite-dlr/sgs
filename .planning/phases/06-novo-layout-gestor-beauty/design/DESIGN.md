---
name: Studio Editorial Density
colors:
  surface: '#faf9f6'
  surface-dim: '#dbdad7'
  surface-bright: '#faf9f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f0'
  surface-container: '#efeeeb'
  surface-container-high: '#e9e8e5'
  surface-container-highest: '#e3e2df'
  on-surface: '#1b1c1a'
  on-surface-variant: '#4d4351'
  inverse-surface: '#2f312f'
  inverse-on-surface: '#f2f1ee'
  outline: '#7f7382'
  outline-variant: '#d0c2d2'
  surface-tint: '#853cad'
  primary: '#370053'
  on-primary: '#ffffff'
  primary-container: '#570080'
  on-primary-container: '#ca7ff3'
  inverse-primary: '#e7b4ff'
  secondary: '#625c66'
  on-secondary: '#ffffff'
  secondary-container: '#e5dde8'
  on-secondary-container: '#66606a'
  tertiary: '#221f27'
  on-tertiary: '#ffffff'
  tertiary-container: '#38343d'
  on-tertiary-container: '#a29ca7'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#f5d9ff'
  primary-fixed-dim: '#e7b4ff'
  on-primary-fixed: '#30004a'
  on-primary-fixed-variant: '#6b2093'
  secondary-fixed: '#e8e0eb'
  secondary-fixed-dim: '#ccc4cf'
  on-secondary-fixed: '#1e1a22'
  on-secondary-fixed-variant: '#4a454e'
  tertiary-fixed: '#e7e0ec'
  tertiary-fixed-dim: '#cbc4cf'
  on-tertiary-fixed: '#1d1a22'
  on-tertiary-fixed-variant: '#49454e'
  background: '#faf9f6'
  on-background: '#1b1c1a'
  surface-variant: '#e3e2df'
typography:
  display-lg:
    fontFamily: Source Serif 4
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Source Serif 4
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Source Serif 4
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Source Serif 4
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Source Serif 4
    fontSize: 17px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Public Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Public Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  body-sm:
    fontFamily: Public Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  data-tabular:
    fontFamily: Public Sans
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-md:
    fontFamily: Public Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
  label-sm:
    fontFamily: Public Sans
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-dense: 0.5rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 2rem
---

## Brand & Style

This design system defines the operational interface for high-end bridal ateliers and luxury makeup studios. It merges the bespoke, tactile elegance of an artisanal leather-bound paper appointment ledger with the high-density information architecture, keyboard-first navigation, and spatial discipline of tools like Linear.

### Aesthetic Axioms
- **Editorial Tactility meets Operational Rigor:** The system avoids generic SaaS tropes. Typography acts as the primary vehicle of luxury, balancing a high-contrast literary serif for human elements (client names, collection titles, milestones) with an uncompromisingly technical sans-serif for operational telemetry (timecodes, inventory SKUs, service durations, cash flows).
- **Paper Realism without Skew:** Clean, unembossed paper surfaces using warm, chalky off-whites. Separation is achieved through precise structural rules (1px micro-borders) rather than simulated lighting or heavy blur.
- **Strict Prohibitions:**
  - Zero gradient washes, neon highlights, or glossy sheen.
  - Zero glassmorphism, blurs, or translucent overlay noise.
  - Zero playful, informal micro-copy, emojis, or whimsical iconography.
  - No indiscriminate uppercase usage for client names, bridal services, or long labels; title casing and sentence casing must preserve editorial dignity.
  - No generic icon badges enclosed in multi-colored pastel circles.

## Colors

The palette is strictly controlled to maintain the atmosphere of a luxury stationery suite while serving dense operational workflows.

### Surface and Canvas Structure
- **Canvas Base (`#F7F6F3`):** Warm textured paper tone. Acts as the bedrock viewport background for all primary layouts, calendar canvas grids, and sidebars.
- **Surface Elevation (`#FFFFFF`):** Pure bright white used for interactive cards, schedule slips, modal dialogue sheets, and table rows.
- **Micro-Borders & Dividers (`#E2DFE5`):** 1px structural hairline strokes separating time slots, data cells, sidebar panels, and forms.

### Typography & Content
- **Primary Ink (`#221E26`):** Deep blackened violet-charcoal. Provides optimal typographic contrast without the harsh, sterile deadness of absolute black (`#000000`).
- **Secondary Ink (`#6B6670`):** Warm graphite neutral. Dedicated to auxiliary data, metadata labels, column headers, and inactive states.

### Action & Focus
- **Brand Primary Accent (`#570080`):** Saturated royal plum. Reserved strictly for key interactive CTAs, active tab strokes, selected booking blocks, and high-priority date anchors. Text placed on this color is always absolute `#FFFFFF`.

### Operational Status Spine Tokens
Statuses do not use loud, pastel-tinted card backgrounds. Every status indicator relies on pure `#FFFFFF` surfaces bounded by a sharp `3px` solid left vertical anchor border (`border-left`):
- **Confirmado (Confirmed):** `#1B7A43` (Deep Forest Green)
- **Em Atendimento (In Progress):** `#0E61A8` (Technical Precision Blue)
- **Agendado (Scheduled):** `#570080` (Primary Plum)
- **Concluído (Completed):** `#49454F` (Architectural Slate)
- **Faltou / Cancelado (No-Show / Cancelled):** `#BA1A1A` (Restrained Crimson)

## Typography

The typographic hierarchy implements a deliberate dual-engine structure:

1. **Source Serif 4 (600 Weight):** Used exclusively for client names, bridal trial labels, primary page titles, and executive balance sheets. It delivers the cadence of a curated high-fashion magazine and bespoke stationary.
2. **Public Sans (400, 500, 600 Weight):** Used for all navigation, table contents, operational controls, form inputs, time stamps, and timeline markers. 
3. **Tabular Numerals (`tnum`):** All financial summaries, countdown timers, scheduled hour intervals (e.g., `09:30 - 11:15`), and operational counts must explicitly apply `font-feature-settings: "tnum" 1` to guarantee vertical column alignment across busy schedules.
4. **Casing Rules:** Uppercase styling is restricted solely to compact metric labels (`label-sm`, e.g., `HORÁRIO`, `SALA`, `STATUS`). Client names must strictly use standard typographic title casing (e.g., *Isabella Vance & Madrinhas*).

## Layout & Spacing

The layout philosophy mirrors the structural grid of high-velocity developer tools like Linear, adapted for multi-chair salon timetables, bridal party room allocations, and technical styling stations.

### Grid Rhythm & Viewports
- **Desktop (1280px+):** Three-tier layout comprising a fixed compact navigation bar (64px collapsed / 240px expanded), an interactive multi-column agenda grid (split by professional or styling station), and an optional collapsible contextual right-hand drawer (360px fixed) for appointment deep-dives.
- **Tablet (768px - 1279px):** Columns scale horizontally with pinned sticky time columns. Two-panel max layout; details view opens as an overlay side sheet.
- **Mobile (<768px):** Single-column agenda view with a sticky chronological day-slider bar. Margins contract to `margin-mobile` (1rem).

### Information Density
- Spacing is dense and intentional. Vertical padding inside agenda cards and data grids is optimized around increments of `0.5rem` (`space-sm`) and `0.75rem` (`space-md`), minimizing unnecessary blank areas while preventing overlap.
- Section boundaries and card groups maintain hairline separation grids rather than excessive empty negative space.

## Elevation & Depth

This system operates without diffused drop shadows (`box-shadow: none`). Spatial depth, hierarchy, and affordance are achieved through two structural mechanics:

1. **Hairline Structural Framing:** Surfaces interact via crisp `1px solid #E2DFE5` perimeter boundaries. Rather than floating on soft clouds, cards sit cleanly on top of `#F7F6F3` or inside segmented grid containers like editorial panels.
2. **Surface Layering:**
   - **Canvas Ground:** `#F7F6F3` (global backdrop).
   - **Panel & Card Level:** `#FFFFFF` with a 1px border.
   - **Active / Dragging Elevation:** When an appointment card is dragged across time slots, elevation is rendered via an instant hard edge: an outline change to `1.5px solid #570080` paired with an inner high-contrast ring, never an omnidirectional blurry shadow.
   - **Modal Backdrop:** Minimal 30% alpha tint (`rgba(34, 30, 38, 0.40)`) to focus focus on the crisp `#FFFFFF` modal frame.

## Shapes

The interface embraces a precise, tailored form factor with a global corner radius token of `6px` (`0.375rem`).

- **Base Controls & Inputs:** All buttons, text fields, search boxes, dropdown menus, and agenda blocks share a strict `6px` radius.
- **Cards & Modals:** Primary cards and modal dialogs maintain the same subtle `6px` radius, evoking stationery index cards and card-stock folios.
- **Zero Ellipses/Pills:** Pill-shaped tags (`border-radius: 9999px`) are forbidden. Micro-badges and status tags adhere strictly to the uniform rectangular `6px` geometry to sustain the architectural discipline.

## Components

Every interactive element must strictly preserve a minimum interactive target size of **44px × 44px** (via visual dimensions or transparent hit-area padding), ensuring fluid, error-free operation on iPads and touch monitors at reception desks.

### Buttons
- **Primary:** Background `#570080`, text `#FFFFFF`, border none, height 44px, padding 0 20px, font `Public Sans` 13px weight 600. Hover state darkens background to `#440064`.
- **Secondary / Outline:** Background `#FFFFFF`, text `#221E26`, border `1px solid #E2DFE5`, height 44px. Hover triggers background `#F7F6F3` with border `#6B6670`.
- **Ghost:** Background transparent, text `#6B6670`, height 44px. Hover state applies text `#221E26` and background `#F7F6F3`.

### Appointment Card (Schedule Slip)
- **Geometry:** Background `#FFFFFF`, border `1px solid #E2DFE5`, corner radius `6px`, padding `10px 14px`.
- **Status Spine:** Left border is precisely `3px solid [Status Color]`, with remaining three borders retaining the standard `1px solid #E2DFE5`.
- **Typography Stack:** Client name in `Source Serif 4` (15px, 600 weight, `#221E26`). Time and service metadata rendered in `Public Sans` (12px, tabular numbers, `#6B6670`).

### Form Inputs & Selectors
- **Input Fields:** Height 44px, background `#FFFFFF`, border `1px solid #E2DFE5`, corner radius `6px`, padding `0 14px`. Text in `Public Sans` 13px `#221E26`. Placeholder `#6B6670`.
- **Active Focus:** Border transitions to `1.5px solid #570080` with zero outer glowing halo.
- **Labels:** Positioned above inputs, `Public Sans` 11px, weight 600, uppercase letter-spacing `0.04em`, color `#6B6670`.

### Status Indicators & Chips
- **Chips:** Flat structure. Background `#F7F6F3`, border `1px solid #E2DFE5`, corner radius `6px`, height 28px (within 44px hit container when interactive). Text in `Public Sans` 11px weight 600.
- **Status Signal:** Accompanied by a 6px solid square or 3px vertical bar in the designated status color; no full-surface tinted fills.

### Checkboxes & Radios
- **Touch Target:** Built within an enforced 44px touch container.
- **Visual Box:** 16px × 16px, corner radius 3px (checkbox) or circular (radio), border `1.5px solid #E2DFE5`, background `#FFFFFF`.
- **Selected State:** Background `#570080`, border `#570080`, checkmark icon in pure `#FFFFFF`.

### Timetable / Calendar Column Headers
- **Layout:** Sticky header blocks with hairline divider below (`1px solid #E2DFE5`). Background `#F7F6F3`.
- **Content:** Professional or Station Name rendered in `Source Serif 4` (14px, weight 600, `#221E26`), flanked by current load counter in `Public Sans` (11px tabular, `#6B6670`).