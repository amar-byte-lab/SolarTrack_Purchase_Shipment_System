# ☀️ SolarTrack ERP — Frontend Design System & Development Guidelines

> **Project Target**: Modern Enterprise Solar Management ERP  
> **Tech Stack**: Angular (Latest Standalone Components + Signals) | .NET 10 Web API | Microsoft SQL Server (LGPMPDB)  
> **Document Purpose**: Single source of truth for architectural standards, UI consistency, design tokens, reusable components, and audit checklist.

---

## 1. Architectural Architecture & Folder Conventions

Every module and component in `SolarTrack.Frontend` follows strict modularization with separate `.scss`, `.ts`, and `.html` files.

```
SolarTrack.Frontend/src/app/
├── core/
│   ├── guards/          # Route guards (auth.guard.ts, admin.guard.ts)
│   ├── models/          # Global entity models (user.model.ts, summary.model.ts)
│   └── services/        # Core business services (auth.service.ts, summary.service.ts, nav.service.ts)
├── layout/
│   ├── components/      # Shell pieces (sidebar/, topbar/)
│   └── layout.component # Shell layout wrapping <router-outlet>
├── shared/
│   ├── components/      # Reusable UI widgets (icon/, status-badge/, empty-state/, toast/, confirm-dialog/)
│   ├── services/        # Global UI services (toast.service.ts, confirm-dialog.service.ts)
│   └── pipes/           # Shared pipes (currency, date format)
└── features/            # Business feature domains (each with models/, services/, components/)
    ├── auth/            # login/, reset-password/
    ├── summary/         # summary-toolbar/, summary-table/, activity-tab/
    ├── quotation/       # quotation builder, adjustments, subsidy, print/
    ├── ledger/          # customer accounts, khatabook banner, txns drawer/
    ├── reports/         # daily, monthly, vendor, item reports, export/
    ├── settings/        # company profile, addresses, bank, subsidy, user RBAC/
    └── files/           # document uploads, preview, download, delete/
```

---

## 2. Global Design Tokens & Unified UI Palette

All components **must** adhere strictly to the following CSS variables defined in [src/styles.scss](file:///c:/Users/AMAR%20CHAND%20MOHANTY/Downloads/SolarTrack_Purchase_Shipment_System/SolarTrack.Frontend/src/styles.scss):

### 🎨 Color Palette
| Token | Hex Value | Usage |
|---|---|---|
| `--st-primary` | `#4338ca` (Indigo 700) | Brand primary color, primary buttons, active links, brand logo line 1 |
| `--st-primary-hover`| `#3730a3` (Indigo 800) | Button hover states, active menu background shadows |
| `--st-primary-light`| `#eef2ff` (Indigo 50) | Active menu link background, badge backgrounds, tag chips |
| `--st-bg` | `#f8fafc` (Slate 50) | ERP application background, workspace background |
| `--st-surface` | `#ffffff` | Card surfaces, modals, table rows, inputs |
| `--st-border` | `#e2e8f0` (Slate 200) | Table borders, card borders, dividers |
| `--st-border-strong`| `#cbd5e1` (Slate 300) | Input borders, dropdown borders |
| `--st-text-main` | `#0f172a` (Slate 900) | Headings, bold data text, primary labels |
| `--st-text-secondary`|`#475569` (Slate 600) | Table headers, secondary labels, description text |
| `--st-text-muted` | `#64748b` (Slate 500) | Timestamps, helper notes, inactive icons |
| `--st-success` | `#10b981` (Emerald 500) | Approved status, credit (You Got), DB connected indicator |
| `--st-danger` | `#ef4444` (Red 500) | Debit (You Gave), rejected status, delete buttons |
| `--st-warning` | `#f59e0b` (Amber 500) | Pending status, in-progress badges |

### 🔤 Typography & Font Sizing
- **Font Family**: `'Inter', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Monospace Family**: `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` (for Quote numbers, IDs, IFSC, Phone numbers, Currency values)
- **Helper Classes**:
  - `.fs-7`: `0.875rem` (14px) — standard body, modal titles, card titles
  - `.fs-8`: `0.8125rem` (13px) — table contents, form labels, badges, secondary notes
  - `.fs-9`: `0.75rem` (12px) — timestamps, micro-tags, column subheaders

---

## 3. Standard Reusable Components Catalog

To ensure complete UI and behavioral consistency, never duplicate buttons, alerts, or dialogs. Use these shared components:

### 1. `app-icon`
Standard stroke SVG icon system with configurable `size` and `strokeWidth`.
```html
<app-icon name="summary" [size]="18"></app-icon>
<app-icon name="plus" [size]="14"></app-icon>
```
*Supported names*: `summary`, `briefcase`, `customer`, `boxes`, `truck`, `file`, `offer`, `agreement`, `calculator`, `circuit`, `wallet`, `gear`, `search`, `plus`, `trash`, `download`, `print`, `logout`.

### 2. `app-status-badge`
Unified status pill that automatically styles itself based on status text:
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

Every page migrated to date has been thoroughly audited against the legacy system for conditions, features, and UI integrity:

| Module | Route | Audited Conditions & Features | Verification Status |
|---|---|---|---|
| **Auth** | `/login`, `/reset-password` | • Form Validation for User ID, Email, and Password.<br>• Password show/hide toggle eye icon.<br>• Dynamic roles fetching from `/api/roles`.<br>• View switcher (Login ↔ Register ↔ Forgot Password).<br>• Token extraction from query parameter (`?token=...`) with expiry & match checks.<br>• Session persistence in `localStorage` (`st_user` & `solar_auth_user`). | ✅ 100% Pass<br>Tested against live backend |
| **Shell & Nav** | Layout Shell | • Dynamic role filtering (Admin sees all; Employee sees Quotation/Doc/Calc/SLD; Partner sees relevant items).<br>• Active route indicator with left blue line (`#4338ca`).<br>• Mobile slide-in drawer with backdrop and close `✕` button.<br>• Database live connection status badge in footer (`SQL Server`).<br>• Topbar with user profile `👤 Username (Role)` and subtle logout button. | ✅ 100% Pass<br>Responsive tested |
| **Summary** | `/summary` | • Dual Tabs: `Summary` (KPIs, stage-wise table) & `Activity` (activity logs).<br>• Search filter across Customer, Mobile, Address, Brand.<br>• Multiselect Partner Filter dropdown.<br>• Horizontal scrollable District badges with dynamic count.<br>• Signal-based calculations for Total kW, Installed kW, Balance kW, and Collections. | ✅ 100% Pass<br>Zero warnings |
| **Quotation** | `/quotation` | • Product set selection checkbox strip with real-time grid generation.<br>• Auto-generated Quote Number: `TR{yy}/{dd}{mm}{hh}{mi}`.<br>• Collapsible Seller & Client Address details.<br>• Items grid with `Mrg.` (Merge Total Value) mode, custom item addition, and delete.<br>• Reactive adjustments: Discount, GST/CGST/SGST taxes, Transport, Labour, Other.<br>• Govt Subsidy selection (3 kW PM Surya Ghar: ₹60,000 State + ₹78,000 Central = ₹138,000) & Net Payable deduction.<br>• Compact A4 print-only template matching official quotation format. | ✅ 100% Pass<br>Live calculation verified |
| **Ledger** | `/ledger` | • Khatabook-style Net Balance Banner with accounts count and eye balance masking.<br>• Filter by All, You Get (Due), You Give (Advance), Settled.<br>• Customer card list with avatar initials.<br>• Drawer/Modal for transaction statement.<br>• You Got (Credit) & You Gave (Debit) entry with live balance update.<br>• Replaced native `confirm()` with `ConfirmDialogService` and `ToastService`. | ✅ 100% Pass<br>Clean API binding |
| **Reports** | `/reports` | • Multi-report type selector (Daily, Monthly, Vendor, Item, Shipment, Transportation, Inventory).<br>• From Date and To Date filtering.<br>• Dynamic table header and row rendering based on report type.<br>• One-click Excel / CSV export functionality and Print layout. | ✅ 100% Pass<br>Tested with mock & live rows |
| **Settings** | `/settings` | • Company Profile (Name, Email, Phone, GST, Default GST %).<br>• Multiple Office Addresses manager (Add & Delete).<br>• Bank Details & UPI ID preview.<br>• Government Subsidy Configuration table (kW, State, Central).<br>• Admin User & Role RBAC Management (Add/Edit User modal, Role selection, Approve/Reject status).<br>• Save to backend database using `ToastService` feedback. | ✅ 100% Pass<br>RBAC verified |
| **Files** | `/files` | • File list with original name, upload date, and formatted file size (KB/MB).<br>• Search filter by name and date range.<br>• Multipart file upload with auto-refresh.<br>• In-browser open preview, download with original filename, and delete with `ConfirmDialogService`. | ✅ 100% Pass<br>Tested against `/api/files` |
| **Documents & Agreements** | `/document`, `/agreement` | • Clean modular standalone architecture.<br>• Reusable `CustomerDirectoryComponent` with search, 10 district filter chips, and standardized 2-line list item format (`Name (District)`, `Consumer No: ...`, and `>` chevron icon on far right with active purple left border indicator).<br>• Reusable `CustomerImportModalComponent` for PM Surya Ghar / DISCOM Excel spreadsheet imports (`.xlsx`, `.xls`, `.csv`), side-by-side comparison cards for conflict detection, field difference highlighting, selectable record merging, and report downloads (`.txt`).<br>• Reusable `ProductSpecsModalComponent` with 5 tabs (`Milestones`, `Inverter`, `PV Module` with auto-serial generator, `DCDB & ACDB`, `Cables & Earthing`) auto-syncing to DB.<br>• 5 Independent Standalone Form Components: `AgreementFormComponent`, `Form1ApplicationComponent`, `Form3InspectionComponent`, `Form4CompletionComponent`, and `Form6CommissionComponent`.<br>• Pixel-perfect A4 official DISCOM Document Preview modal with print stylesheet.<br>• Demand Note & Work Note removed from this module per enterprise requirements. | ✅ 100% Pass<br>Browser verified |

---

## 5. Mandatory Checklist for All Future Pages

When implementing upcoming pages (**`customer.html`**, **`manage-work.html`**, **`inventory.html`**, **`shipment.html`**, **`sizing-calc.html`**, **`sld.html`**), developers **must strictly comply** with this checklist:

1. **File Separation**: Every component must have separate `.ts`, `.html`, and `.scss` files. No inline templates or inline styles.
2. **Design Tokens**: Use standard CSS variables (`var(--st-primary)`, `var(--st-surface)`, `var(--st-border)`). Do not hardcode arbitrary hex colors.
3. **Buttons**: Use standard `.btn .btn-primary`, `.btn-outline-secondary`, `.btn-sm`, `.btn-xs`. Do not invent custom button classes without extending `.btn`.
4. **Icons**: Use `<app-icon name="...">` or standard SVGs with `stroke-width="1.75"`.
5. **Status Badges**: Use `<app-status-badge [status]="...">` for all status and pill indicators.
6. **Confirmations & Alerts**: Never use native JavaScript `alert()` or `confirm()`. Always inject `ToastService` and `ConfirmDialogService`.
7. **Empty States**: If a table or list can be empty, include `<app-empty-state>` with an appropriate icon and CTA button.
8. **Signal Reactivity**: Use Angular Signals (`signal()`, `computed()`) for reactive state and calculations.
9. **Build Verification**: Run `npm run build` after completion to ensure 0 errors and 0 warnings.
