# ☀️ SolarTrack ERP — Frontend Design System & Development Guidelines
> **Design System Origin**: Extracted from [Squared Media](https://www.squared-media.nl/)  
> **Master Theme File**: [src/theme.scss](file:///c:/Users/AMAR%20CHAND%20MOHANTY/Downloads/SolarTrack_Purchase_Shipment_System/SolarTrack.Frontend/src/theme.scss) & root [theme.scss](file:///c:/Users/AMAR%20CHAND%20MOHANTY/Downloads/SolarTrack_Purchase_Shipment_System/theme.scss)  
> **Tech Stack**: Angular 21 (Standalone Components + Signals + SCSS) | .NET 10 Web API | Microsoft SQL Server (SolarDb)  
> **Document Purpose**: Single source of truth for architectural standards, UI consistency, design tokens, reusable components, and audit checklist. **All project additions and modifications must strictly comply with this design system.**

---

## 1. Architectural Guidelines & Enforced Theme Rules

1. **Strict Design Token Adoption**: Every component in `SolarTrack.Frontend` and prototype views in `dist/` **must** consume CSS custom properties defined in `theme.scss` (`var(--st-primary)`, `var(--st-surface)`, `var(--st-border)`, etc.).
2. **Zero Hardcoded Brand Hex Codes**: No hardcoding of `#4338ca`, `#3730a3`, `#6d28d9`, or arbitrary color codes. If a theme color is needed, reference `var(--st-primary)`, `var(--st-surface-raised)`, `var(--st-border)`, etc.
3. **Squared Media Typography Triad**:
   - **Headings & Display**: Space Grotesk (`var(--st-font-display)`), bold tracking tight (`-0.04em`), tight line-height (`1.15`).
   - **Body & Controls**: Figtree (`var(--st-font-family)`), geometric humanist sans for exceptional interface readability.
   - **Kickers, Badges & Numbers**: JetBrains Mono (`var(--st-font-mono)`), monospace kicker tracking (`0.14em`), uppercase.
4. **Squared Media Geometric Radii Hierarchy**:
   - `var(--st-radius-sm)`: 6px
   - `var(--st-radius-md)`: 8px
   - `var(--st-radius-ui)`: 12px (Form inputs, interactive buttons, select dropdowns)
   - `var(--st-radius-card)`: 20px (Card containers, summary boxes, modals)
   - `var(--st-radius-block)`: 28px (Hero panels, major calculation cards)
   - `var(--st-radius-pill)`: 999px (Pills, badges, search bar)
5. **Squared Media Interactive Button Physics**:
   - Buttons use spring physics easing `cubic-bezier(0.34, 1.8, 0.64, 1)`.
   - Hover state produces a lift `transform: translateY(-2px) scale(1.015)` and Flame Bloom shadow `var(--st-shadow-flame)`.
   - Active press produces a slight tactile compression `transform: scale(0.96)`.

---

## 2. Global Design Tokens & Unified UI Palette

All components **must** adhere strictly to the CSS variables defined in [src/theme.scss](file:///c:/Users/AMAR%20CHAND%20MOHANTY/Downloads/SolarTrack_Purchase_Shipment_System/SolarTrack.Frontend/src/theme.scss):

### 🎨 Color Palette & Thematic Anchors

| Token | CSS Variable Value | Role & Usage |
|---|---|---|
| **Signature Flame** | `--st-primary: #ff4500` | Squared Media primary accent, primary action buttons, active tab indicators, brand logo line 1 |
| **Flame Hover** | `--st-primary-hover: #e03d00` | Button hover state, interactive highlights |
| **Flame Light** | `--st-primary-light: #fff2ed` | Active sidebar link background, badge backgrounds, tag chips |
| **Flame Subtle** | `--st-primary-subtle: #ffe5dc` | Soft focus wells, subtle highlight container |
| **Flame Glow** | `--st-primary-glow: 0 0 35px rgba(255, 69, 0, 0.35)` | Bloom drop shadow for CTA buttons and highlighted badges |
| **Warm Linen Base** | `--st-bg: #f5f3f0` | Soft warm sand canvas background for the entire application |
| **Surface Crisp** | `--st-surface: #ffffff` | Clean card surfaces, dialogs, table rows, form inputs |
| **Surface Raised** | `--st-surface-raised: #eeece7` | Table header bars, inactive button wells, elevated panels |
| **Surface Soft** | `--st-surface-soft: #e7e4de` | Muted wells, sub-section containers |
| **Border Subtle** | `--st-border: rgba(20, 20, 18, 0.12)` | Table row borders, card dividers, container separators |
| **Border Strong** | `--st-border-strong: rgba(20, 20, 18, 0.22)` | Form input borders, active dropdown boundaries |
| **Text Main** | `--st-text-main: #141412` | Deep charcoal ink for headings, primary data values, bold titles |
| **Text Secondary**| `--st-text-secondary: #545f46` | Muted olive gray for descriptions, subheadings, table headers |
| **Text Muted** | `--st-text-muted: #8c8983` | Timestamps, helper notes, inactive icons |
| **Success** | `--st-success: #10b981` | Approved status, credit (You Got), DB connected indicator |
| **Danger** | `--st-danger: #ef4444` | Debit (You Gave), rejected status, delete buttons |
| **Warning** | `--st-warning: #f59e0b` | Pending status, in-progress badges |
| **Info** | `--st-info: #0284c7` | Informational callouts and notices |

### 🌿 Editorial Sage Theme Palette (`.sq-sage`)
Used for high-impact showcase cards, KPI banners, and featured summary blocks:
- `--st-sage-base: #b8c0a5` (Muted organic sage)
- `--st-sage-surface: #b0b99c`
- `--st-sage-raised: #a7b192`
- `--st-sage-soft: #96a27f`
- `--st-sage-fg: #182113` (Deep forest olive ink)
- `--st-sage-fg-dim: #545f46`
- `--st-sage-line: rgba(24, 33, 19, 0.16)`

### 🔤 Typography & Font Hierarchy
- **Display Headings**: `'Space Grotesk', system-ui, -apple-system, sans-serif` (`var(--st-font-display)`)
- **Body & UI**: `'Figtree', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` (`var(--st-font-family)`)
- **Monospace Family**: `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` (`var(--st-font-mono)`)
- **Helper Classes**:
  - `.font-display`: Space Grotesk headline styling with tight tracking.
  - `.font-sans`: Figtree clean interface body text.
  - `.font-mono`: JetBrains Mono for Quote numbers, IDs, IFSC, Phone numbers, Currency values.
  - `.kicker`: JetBrains Mono uppercase tracking `.16em` in Flame color.
  - `.fs-7`: `0.875rem` (14px) — standard body, modal titles, card titles.
  - `.fs-8`: `0.8125rem` (13px) — table contents, form labels, badges, secondary notes.
  - `.fs-9`: `0.75rem` (12px) — timestamps, micro-tags, column subheaders.

---

## 3. Standard Reusable Components Catalog

To ensure complete UI and behavioral consistency, never duplicate buttons, alerts, or dialogs. Use these shared components:

### 1. `app-icon`
Standard stroke SVG icon system with configurable `size` and `strokeWidth`.
```html
<app-icon name="summary" [size]="18"></app-icon>
<app-icon name="plus" [size]="14"></app-icon>
```

### 2. `app-status-badge`
Unified status pill with Squared Media pill radius (`999px`) and JetBrains Mono typography:
```html
<app-status-badge [status]="user.status"></app-status-badge>
<app-status-badge status="Approved"></app-status-badge>
<app-status-badge status="Pending"></app-status-badge>
<app-status-badge status="Rejected"></app-status-badge>
```

### 3. `app-empty-state`
Consistent empty state card with icon, title, description, and action button emitter:
```html
<app-empty-state
  icon="📂"
  title="No files found"
  description="Upload your purchase bills or invoices to get started."
  actionText="Upload Document"
  (actionClick)="openUploadModal()">
</app-empty-state>
```

### 4. `ToastService`
Enterprise notification toast that floats at the bottom-right and auto-dismisses after 3.2 seconds:
```typescript
toastService = inject(ToastService);

this.toastService.success('Customer updated successfully!');
this.toastService.error('Failed to save record to server.');
this.toastService.warning('Please enter all required fields.');
this.toastService.info('Syncing offline data...');
```

### 5. `ConfirmDialogService`
Promise-based modal replacement for native `window.confirm()`:
```typescript
confirmService = inject(ConfirmDialogService);

async onDelete(item: any): Promise<void> {
  const confirmed = await this.confirmService.confirm({
    title: 'Delete Customer',
    message: `Are you sure you want to permanently delete "${item.name}"?`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    isDanger: true
  });

  if (confirmed) {
    // Proceed with deletion
  }
}
```

---

## 4. Page-by-Page Audit of Migrated Modules

Every page in the project has been updated and audited against the Squared Media Design System:

| Module | Route | Audited Conditions & Features | Design System Verification |
|---|---|---|---|
| **Auth** | `/login`, `/reset-password` | Form Validation, Password toggle, Role switcher, Token extraction, Session persistence in `localStorage`. | ✅ 100% Pass<br>Squared Media warm canvas, block radius (28px), Flame CTA button with spring hover physics. |
| **Shell & Nav** | Layout Shell | Dynamic role filtering, active route indicator with Flame accent line (`#ff4500`), mobile slide-in drawer, live DB status badge, topbar with profile. | ✅ 100% Pass<br>Space Grotesk branding, pill status tag, warm surface. |
| **Summary** | `/summary` | KPIs, stage-wise table & Activity tab. Search filter, partner dropdown, district badges, signals. | ✅ 100% Pass<br>Table headings in JetBrains Mono, Flame action buttons, 20px card radius. |
| **Quotation** | `/quotation` | Product set selection, Auto quote number `TR{yy}/{dd}{mm}{hh}{mi}`, Items grid with Mrg. mode, adjustments, subsidy calculation. | ✅ 100% Pass<br>Input focus rings in Flame, monospace monetary values. |
| **Ledger** | `/ledger` | Khatabook-style Net Balance Banner, Due (Flame), Advance (Emerald), Settled, avatar initials, statement drawer. | ✅ 100% Pass<br>Squared Media card radius, spring button transitions, tabular monetary layout. |
| **Reports** | `/reports` | Multi-report selector, From/To Date filter, dynamic header/row rendering, Excel/CSV export and Print layout. | ✅ 100% Pass<br>Space Grotesk section titles, clean table surface. |
| **Settings** | `/settings` | Company Profile, Office Addresses manager, Bank Details, Subsidy config table, Admin RBAC. | ✅ 100% Pass<br>Squared Media active tabs with Flame line indicator, 20px card radius. |
| **Files** | `/files` | File list, search filter, multipart upload, preview modal, download, and delete dialog. | ✅ 100% Pass<br>Flame file icon containers, unified table style. |
| **Documents & Agreements** | `/document`, `/agreement` | CustomerDirectoryComponent, CustomerImportModal, ProductSpecsModal, 5 DISCOM form components, A4 preview modal. | ✅ 100% Pass<br>Flame active selection border, Figtree typography. |
| **Calculator & Inventory** | `/sizing-calc`, `/inventory` | System type selector, sizing result cards, appliance load manager, inventory categories and summary modal. | ✅ 100% Pass<br>Flame gradient inverter cards, pill status tags. |

---

## 5. Mandatory Checklist for All Future Additions & Modifications

When adding any new feature, modifying existing pages, or creating components, developers **must strictly comply** with this checklist:

1. **File Separation**: Every component must have separate `.ts`, `.html`, and `.scss` files. No inline templates or inline styles.
2. **Design Tokens Only**: Use standard CSS variables (`var(--st-primary)`, `var(--st-surface)`, `var(--st-border)`, `var(--st-radius-card)`). Never hardcode arbitrary hex colors.
3. **Typography Compliance**: Headings use Space Grotesk (`var(--st-font-display)`), body uses Figtree (`var(--st-font-family)`), and codes/dates/currency use JetBrains Mono (`var(--st-font-mono)`).
4. **Interactive Controls & Buttons**: Use standard `.btn .btn-primary`, `.btn-outline-primary`, `.btn-sm`, `.btn-xs`. All buttons must inherit the spring physics hover and active states.
5. **Border Radii Hierarchy**: Inputs/buttons: `12px` (`var(--st-radius-ui)`), Cards: `20px` (`var(--st-radius-card)`), Badges/Pills: `999px` (`var(--st-radius-pill)`).
6. **Icons**: Use `<app-icon name="...">` or standard SVGs with `stroke-width="1.75"`.
7. **Status Badges**: Use `<app-status-badge [status]="...">` for all status and pill indicators.
8. **Confirmations & Alerts**: Never use native JavaScript `alert()` or `confirm()`. Always inject `ToastService` and `ConfirmDialogService`.
9. **Build Verification**: Run `npm run build` inside `SolarTrack.Frontend` after completion to ensure 0 errors and clean compilation.
