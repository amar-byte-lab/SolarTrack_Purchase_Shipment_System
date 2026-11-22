# ☀️ SolarTrack ERP — Visual Design System Specification

> **Master Theme SCSS**: [SolarTrack.Frontend/src/theme.scss](file:///c:/Users/AMAR%20CHAND%20MOHANTY/Downloads/SolarTrack_Purchase_Shipment_System/SolarTrack.Frontend/src/theme.scss)  
> **Global Resets & Styles**: [SolarTrack.Frontend/src/styles.scss](file:///c:/Users/AMAR%20CHAND%20MOHANTY/Downloads/SolarTrack_Purchase_Shipment_System/SolarTrack.Frontend/src/styles.scss)  
> **Origin Reference**: Extracted from [Squared Media](https://www.squared-media.nl/) & Tuned for SolarTrack ERP  
> **Core Architecture**: Angular 21 (Standalone Components + Signals + SCSS) | Bootstrap 5.3 Framework + Custom Design Tokens

This document is the **strict, single source of truth** for all visual design tokens, typography scales, layout rules, component styles, icon conventions, and interaction physics. **All future UI additions and modifications must adhere 100% to these specifications.**

---

## 1. Color Palette

All colors are codified as CSS custom properties defined on `:root` in `theme.scss`. Never hardcode arbitrary hex codes in component styles; always reference `var(--st-*)`.

### 1.1 Brand Primary & Accent Tokens
Anchored by the signature International Flame Orange accent.

| Token | CSS Variable | Hex / Value | RGB / Alpha | Usage |
|---|---|---|---|---|
| **Primary Accent** | `--st-primary` | `#ff4500` | `rgb(255, 69, 0)` | Primary action buttons, active navigation indicator dots, active tabs, brand subtitle, focus outlines |
| **Primary Hover** | `--st-primary-hover` | `#e03d00` | `rgb(224, 61, 0)` | Button hover state, interactive link hover |
| **Primary Active** | `--st-primary-active` | `#cc3700` | `rgb(204, 55, 0)` | Button click/pressed state |
| **Primary Dark** | `--st-primary-dark` | `#b33000` | `rgb(179, 48, 0)` | Button borders, dark shadow accents |
| **Primary Light** | `--st-primary-light` | `#fff2ed` | `rgba(255, 69, 0, 0.07)` | Tinted pill badges, chip backgrounds, light hover tints |
| **Primary Subtle** | `--st-primary-subtle` | `#ffe5dc` | `rgba(255, 69, 0, 0.14)` | Soft alert wells, focused selection backgrounds |
| **Primary Border** | `--st-primary-border` | — | `rgba(255, 69, 0, 0.28)` | Outline button borders, badge borders |
| **Primary Glow** | `--st-primary-glow` | — | `0 0 35px rgba(255, 69, 0, 0.35)` | Bloom elevation shadow on hover |
| **Primary Glow Sm**| `--st-primary-glow-sm`| — | `0 0 16px rgba(255, 69, 0, 0.45)` | Badge and icon glow |

### 1.2 Backgrounds, Canvas & Surface System
The application uses an organic sage background canvas harmonized with frosted liquid glass and crisp white surfaces.

| Token | CSS Variable | Hex / Value | Usage |
|---|---|---|---|
| **Canvas Background** | `--st-bg` | `#b4c5a2` | Main viewport canvas, body background (`rgb(180, 197, 162)`) |
| **Pure Surface** | `--st-surface` | `#ffffff` | Inner card surfaces, form inputs, modal bodies, table rows |
| **Frosted Glass Surface**| `--st-glass-surface` | `rgba(255, 255, 255, 0.72)` | Shell sidebar, topbar, floating toolbar panels |
| **Elevated Surface** | `--st-surface-raised` | `#a7b994` | Sticky table headers, inactive button wells, elevated panels |
| **Soft Surface** | `--st-surface-soft` | `#c1d0b1` | Secondary containers, subsection wells |
| **Row Hover** | `--st-surface-hover` | `#f3f5ee` | Table row hover, dropdown item hover |
| **Subtle Border** | `--st-border` | `rgba(24, 33, 19, 0.14)` | Table row dividers, card borders, hairline separators |
| **Strong Border** | `--st-border-strong` | `rgba(24, 33, 19, 0.28)` | Form inputs, select dropdowns, card outlines |

### 1.3 Neutral Typography Colors (Deep Forest Ink)
High-contrast organic ink colors engineered specifically for legibility over `#b4c5a2` and `#ffffff`.

| Token | CSS Variable | Hex Value | Usage |
|---|---|---|---|
| **Text Main** | `--st-text-main` | `#182113` | Headings (H1–H6), table headers, primary data values, bold titles |
| **Text Secondary**| `--st-text-secondary`| `#3b4731` | Body descriptions, form labels, secondary values, breadcrumbs |
| **Text Muted** | `--st-text-muted` | `#5e6b54` | Helper notes, timestamps, inactive icons |
| **Text Disabled** | `--st-text-disabled` | `#8a9682` | Disabled controls, inactive chevron icons |
| **Brand Ink** | `--st-brand-ink` | `#0d0d0c` | Ultra-deep obsidian black for high-contrast pills |
| **Brand Mint** | `--st-brand-mint` | `#eeece7` | Warm parchment cream for dark mode text |

### 1.4 Semantic Feedback & Status Colors

| Semantic State | Base Color | Dark Shade | Light Background | Border Color | Usage |
|---|---|---|---|---|---|
| **Success** | `#10b981` (`--st-success`) | `#059669` | `#ecfdf5` | `#a7f3d0` | Approved, Completed, Delivered, Credit (+), Active |
| **Danger** | `#ef4444` (`--st-danger`) | `#dc2626` | `#fef2f2` | `#fecaca` | Rejected, Failed, Overdue, Debit (-), Delete actions |
| **Warning** | `#f59e0b` (`--st-warning`) | `#d97706` | `#fffbeb` | `#fde68a` | Pending, In Progress, Dispatched, Working |
| **Info** | `#0284c7` (`--st-info`) | `#0369a1` | `#f0f9ff` | `#bae6fd` | In Transit, System notices, Role badges |

---

## 2. Typography

The typography system relies on three specialized variable Google Fonts preloaded in [src/index.html](file:///c:/Users/AMAR%20CHAND%20MOHANTY/Downloads/SolarTrack_Purchase_Shipment_System/SolarTrack.Frontend/src/index.html).

### 2.1 Font Families

```scss
--st-font-display: 'Space Grotesk', system-ui, -apple-system, sans-serif;
--st-font-family:  'Figtree', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--st-font-mono:    'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
```

* **Display / Headings (`--st-font-display`)**: Geometric neo-grotesk with monospace heritage. Used for all main page titles, modal headers, card titles, and brand line 1.
* **Body & Interface (`--st-font-family`)**: Humanist geometric sans with exceptional legibility at dense ERP data scales. Used for body copy, buttons, labels, and table cells.
* **Monospace / Kickers / Numbers (`--st-font-mono`)**: Technical developer monospace with tabular figures. Used for Quote IDs (`TR26/...`), currency (`₹59,26,950`), phone numbers, dates, status pills, and uppercase kickers.

### 2.2 Type Scale Hierarchy

| Element | Class | Font Family | Size | Weight | Line Height | Letter Spacing |
|---|---|---|---|---|---|---|
| **Display / Hero** | `.display-heading` | Space Grotesk | `2.0rem` (32px) | 700 / 800 | `1.10` | `-0.05em` |
| **H1** | `h1` | Space Grotesk | `1.5rem` (24px) | 700 | `1.15` | `-0.04em` |
| **H2** | `h2` | Space Grotesk | `1.25rem` (20px) | 700 | `1.20` | `-0.03em` |
| **H3** | `h3` | Space Grotesk | `1.15rem` (18.4px)| 700 | `1.20` | `-0.025em` |
| **H4 / Topbar**| `h4, .topbar-title` | Space Grotesk | `1.08rem` (17.3px)| 700 | `1.20` | `-0.02em` |
| **H5 / Card Head**| `h5, .section-title` | Space Grotesk | `0.96rem` (15.4px)| 700 | `1.25` | `-0.02em` |
| **H6** | `h6` | Space Grotesk | `0.90rem` (14.4px)| 600 | `1.30` | `-0.01em` |
| **Body (Standard)**| `body, .fs-7` | Figtree | `0.875rem` (14px) | 400 / 500 | `1.50` | `normal` |
| **Body (Compact)** | `.fs-8` | Figtree | `0.8125rem` (13px)| 500 / 600 | `1.40` | `normal` |
| **Micro / Subtitle**| `.fs-9` | Figtree | `0.75rem` (12px)  | 500 | `1.33` | `normal` |
| **Monospace Kicker**| `.kicker` | JetBrains Mono | `0.75rem` (12px)  | 700 | `1.20` | `+0.16em` (uppercase) |
| **Table Headers** | `thead th` | JetBrains Mono | `0.74rem` (11.8px)| 700 | `1.20` | `+0.06em` (uppercase) |
| **Currency Values**| `.font-mono` | JetBrains Mono | `0.85rem – 1.45rem`| 700 / 800 | `1.10` | `-0.02em` |

---

## 3. Spacing & Layout System

### 3.1 Layout Dimensions
* **Sidebar Width**: `250px` (`--st-sidebar-width`)
* **Topbar Height**: `60px` (`--st-topbar-height`)
* **Page Body Padding**: `16px 20px` (Desktop), `12px` (Mobile)
* **Mobile Sidebar Collapse Breakpoint**: `900px` (`@media (max-width: 900px)`)

### 3.2 Container Scales & Modals
* **Auth Box**: `max-width: 440px`
* **Workflow Modal**: `max-width: 490px`
* **Import / Edit Customer Modal**: `max-width: 860px`
* **Document A4 Preview Modal**: `max-width: 960px`
* **Table Viewport Height Clamp**: `max-height: calc(100vh - 310px); min-height: 400px;`

### 3.3 Spacing Scale & Gaps
* `4px`: Pill tab gap, micro tag gap
* `6px`: Icon-to-text button gap, dropdown item padding
* `8px`: Form input group gap, toolbar element spacing
* `12px`: Section items gap, card internal stack gap
* `16px`: Major card margin-bottom, page content stack gap
* `20px – 24px`: Card internal padding, topbar horizontal padding

---

## 4. Components & Borders

### 4.1 Border Radius Hierarchy
The design system enforces an architectural curvature scale. Sharp `0px` or `2px` corners are prohibited.

```scss
--st-radius-sm:    6px;   // Micro indicators, inner image thumbnails
--st-radius-md:    8px;   // Small icon containers, compact dropdown items
--st-radius-ui:    12px;  // Interactive controls, form inputs, standard buttons
--st-radius-lg:    16px;  // Floating dropdown menus, popovers
--st-radius-card:  20px;  // Standard cards, table containers, dialogs
--st-radius-block: 28px;  // Major hero panels, auth cards, large modals
--st-radius-pill:  999px; // Badges, pill tabs, search bars, pill buttons
```

### 4.2 Elevation & Box Shadows

```scss
--st-shadow-xs:       0 1px 2px rgba(24, 33, 19, 0.04);
--st-shadow-sm:       0 2px 4px rgba(24, 33, 19, 0.05), 0 1px 2px rgba(24, 33, 19, 0.03);
--st-shadow:          0 4px 16px rgba(24, 33, 19, 0.07), 0 1px 3px rgba(24, 33, 19, 0.04);
--st-shadow-md:       0 10px 30px rgba(24, 33, 19, 0.09), 0 4px 10px rgba(24, 33, 19, 0.04);
--st-shadow-lg:       0 20px 48px rgba(24, 33, 19, 0.14);
--st-shadow-nav:      0 18px 50px rgba(24, 33, 19, 0.16);
--st-shadow-flame:    0 0 40px rgba(255, 69, 0, 0.35);
--st-shadow-flame-sm: 0 0 18px rgba(255, 69, 0, 0.45);
--st-shadow-inset:    inset 0 20px 40px -20px rgba(24, 33, 19, 0.2);
```

### 4.3 Button Component System

All buttons extend the `.btn` base class and inherit spring physics.

```scss
.btn {
  font-family: var(--st-font-family);
  font-weight: 600;
  border-radius: var(--st-button-radius, 12px);
  transition: all 0.22s var(--st-ease-spring);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  line-height: 1.4;
  cursor: pointer;

  &:focus {
    box-shadow: 0 0 0 3px rgba(255, 69, 0, 0.22) !important;
    outline: none;
  }

  &:hover:not(:disabled) {
    transform: translateY(-2px) scale(1.015);
  }

  &:active:not(:disabled) {
    transform: scale(0.96);
  }
}
```

* **Primary Action (`.btn-primary`)**:
  * Background: `var(--st-primary)` (`#ff4500`)
  * Border: `var(--st-primary-hover)`
  * Color: `#ffffff`
  * Shadow: `0 2px 8px rgba(255, 69, 0, 0.25)`
  * Hover: Background `#e03d00`, Shadow `var(--st-shadow-flame)`
* **Outline Primary (`.btn-outline-primary`)**:
  * Border: `var(--st-primary-border)`
  * Color: `var(--st-primary)`
  * Hover: Background `var(--st-primary-light)`, Shadow `var(--st-shadow-flame-sm)`
* **Outline Secondary (`.btn-outline-secondary`)**:
  * Border: `rgba(24, 33, 19, 0.16)`
  * Color: `var(--st-text-secondary)` (`#3b4731`)
  * Hover: Background `var(--st-surface-raised)`, Color `#182113`
* **Pill Modifier (`.btn-pill`)**: `border-radius: 999px !important;`
* **Sizing**:
  * Standard: `padding: 8px 18px; font-size: 0.85rem;`
  * Small (`.btn-sm`): `padding: 6px 14px; font-size: 0.8125rem;`
  * Extra Small (`.btn-xs`): `padding: 4px 10px; font-size: 0.75rem; border-radius: var(--st-radius-md);`

### 4.4 Form Controls & Inputs

```scss
.form-control, .form-select {
  font-family: var(--st-font-family);
  font-size: 0.84rem;
  color: #182113;
  background-color: #ffffff;
  border: 1px solid rgba(24, 33, 19, 0.16);
  border-radius: var(--st-radius-ui, 12px);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &:focus {
    border-color: var(--st-primary);
    box-shadow: 0 0 0 3px rgba(255, 69, 0, 0.18);
    outline: 0;
  }
}

/* Search Bars */
.search-input-wrap .form-control {
  border-radius: var(--st-radius-pill, 999px) !important;
  padding-left: 36px;
}
```

### 4.5 Card & Container Styles

```scss
.st-card, .card {
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.85);
  border-radius: var(--st-radius-card, 20px);
  box-shadow: 0 10px 30px rgba(24, 33, 19, 0.06);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
```

### 4.6 Organic Pill Tab Switcher (`.erp-tabs`)

Used for view and stage switches (e.g., Summary ↔ Activity):

```scss
.erp-tabs {
  border: none;
  background: rgba(24, 33, 19, 0.09);
  backdrop-filter: blur(16px);
  padding: 4px;
  border-radius: var(--st-radius-pill, 999px);
  border: 1px solid rgba(24, 33, 19, 0.1);
  display: inline-flex;
  gap: 4px;

  .nav-link {
    color: #2b3820;
    border: none;
    padding: 7px 20px;
    font-size: 0.84rem;
    font-weight: 600;
    background: transparent;
    border-radius: var(--st-radius-pill, 999px);
    transition: all 0.22s var(--st-ease-spring);

    &:hover {
      color: #182113;
      background: rgba(255, 255, 255, 0.45);
    }

    &.active {
      background: #182113;
      color: #ffffff;
      font-weight: 700;
      box-shadow: 0 4px 14px rgba(24, 33, 19, 0.2);

      svg {
        stroke: var(--st-primary, #ff4500);
      }
    }
  }
}
```

---

## 5. Icons & Media

### 5.1 Icon Library Specification
The application utilizes an internal **Lucide / Feather stroke SVG architecture** rendered via `<app-icon>`.

* **Component**: `SolarTrack.Frontend/src/app/shared/components/icon/icon.component.ts`
* **Default Stroke Width**: `1.75` (Configurable `stroke-width="1.75"` or `2.0`)
* **SVG Config**: `fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round;`
* **Default Sizing**:
  * Button / Inline Action Icons: `14px`
  * Standard UI / Table Icons: `16px`
  * Sidebar Navigation Icons: `18px`
  * Modal Headers / Empty State Icons: `20px – 24px`

### 5.2 Supported Icon Names Catalogue
* **Navigation & Domain**: `summary`, `briefcase` (manage-work), `customer`, `boxes` (inventory), `truck` (shipment), `file`, `offer` (quotation), `agreement`, `calculator`, `circuit` (sld), `wallet` (ledger), `gear` (settings).
* **Actions & Controls**: `search`, `plus`, `trash`, `download`, `print`, `logout`, `chevron-right`, `chevron-down`, `check`, `x`, `alert-circle`, `zap`, `sun`, `battery-charging`, `power`.

### 5.3 Media Assets
* **Brand Logo**: `assets/sampleFiles/LogoWithoutLetter.png` (Height `34px`, drop shadow `0 2px 4px rgba(24, 33, 19, 0.08)`).

---

## 6. Transitions, Physics & Interactive States

### 6.1 Easing & Timing Constants

```scss
--st-ease-spring:       cubic-bezier(0.34, 1.8, 0.64, 1); // Hover spring bounce
--st-ease-smooth:       cubic-bezier(0.16, 1, 0.3, 1);    // Fluid drawer slides
--st-transition-fast:   all 0.15s ease-in-out;
--st-transition-spring: all 0.22s var(--st-ease-spring);
```

### 6.2 Interactive States
1. **Hover State**:
   * Buttons & Cards: `transform: translateY(-2px) scale(1.015);`
   * Primary Buttons: Box shadow blooms to `var(--st-shadow-flame)`.
   * Nav Links: `transform: translateX(2px); background: rgba(24, 33, 19, 0.06);`
2. **Active / Pressed State**:
   * Buttons: `transform: scale(0.96);` tactile click compression.
3. **Focus State**:
   * `outline: none;`
   * Focus Ring: `box-shadow: 0 0 0 3px rgba(255, 69, 0, 0.18) !important;`
   * Border: `border-color: var(--st-primary) !important;`
4. **Disabled State**:
   * `opacity: 0.6; cursor: not-allowed; transform: none !important;`

---

## 7. Mandatory Developer Enforcement Checklist

When building new features or refactoring existing views:

1. **Zero Hardcoded Colors**: Never write hex codes like `#4338ca` or `#ffffff` in CSS. Use `var(--st-primary)`, `var(--st-bg)`, `var(--st-surface)`, etc.
2. **Font Triad Compliance**: Headings must use Space Grotesk (`var(--st-font-display)`), body must use Figtree (`var(--st-font-family)`), and values/dates/IDs must use JetBrains Mono (`var(--st-font-mono)`).
3. **Curvature Scale**: Inputs/buttons = `12px` (`var(--st-radius-ui)`), Cards/modals = `20px` (`var(--st-radius-card)`), Badges/pills = `999px` (`var(--st-radius-pill)`). Sharp 2px/4px corners are forbidden.
4. **No Harsh Borders**: Shell containers, sidebars, and topbars must use frosted glass (`rgba(255, 255, 255, 0.72); backdrop-filter: blur(24px);`) with hairline borders (`rgba(24, 33, 19, 0.08)`).
5. **Spring Physics**: All interactive buttons must have hover lift and active press transitions.
6. **Build Integrity**: Run `npm run build` in `SolarTrack.Frontend` before completing any turn. Compilation must pass with **0 errors**.
