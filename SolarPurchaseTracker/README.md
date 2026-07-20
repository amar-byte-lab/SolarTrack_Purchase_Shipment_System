# SolarTrack — Offline Purchase & Shipment Cost Management System

A 100% offline, no-backend, no-database business app for a solar equipment
business. Built with pure HTML5, CSS3, Bootstrap 5 and vanilla JavaScript
(ES6). All data is read from and written to real **.xlsx files on your own
computer** — there is no server, no cloud, no SQL database, and no internet
connection required at any point.

## How it stores data

The app works with a **Database folder** containing five Excel workbooks:

```
Database/
    Shipments.xlsx
    Materials.xlsx
    Vendors.xlsx
    Items.xlsx
    Settings.xlsx
```

- If you already have a workbook with this data, point the app at the
  folder that contains it. The app only ever **adds** a sheet if one is
  missing — it never deletes or overwrites sheets/data that are already
  there.
- If the folder is empty (or you create a brand-new one), the app creates
  all five workbooks automatically with the correct headers.

### Two ways the app connects to your files

1. **Live folder mode** (Chrome / Edge / any Chromium browser) — uses the
   File System Access API. You pick the `Database` folder once, and from
   then on every add/edit/delete is written straight back into the real
   .xlsx files on disk, instantly, with no extra steps. The app remembers
   the folder for next time (your browser will ask you to re-confirm
   permission each new session — that's a browser security rule).

2. **Upload / Download mode** (Firefox, Safari, or any browser without the
   File System Access API) — you upload the five .xlsx files once per
   session. All edits happen in memory, and you click
   **Settings → Download Updated Excel Files** to save your changes back
   to disk as fresh copies. Still entirely offline — nothing leaves your
   computer.

## Running it

No install, no build step, no server:

1. Open `index.html` in Chrome or Edge (recommended, for live folder mode).
2. Choose **Open / Create Database Folder** and select (or create) your
   `Database` folder — the `excel/` folder included in this project works
   fine as a starting point, or use your own.
3. Start adding Shipments — everything else (Dashboard, Reports, Item
   Master, Vendor Master) is calculated automatically from that data.

## What it calculates

For every shipment:

```
Material Purchase Value   = Quantity x Purchase Rate
Shipment Purchase Total   = SUM(all Material Purchase Values)
GST Amount                = Shipment Purchase Total x GST%
Grand Total                = Shipment Purchase Total + GST Amount + Transportation

Transportation Share (per material) = (Material Value / Shipment Total) x Transportation
GST Share (per material)            = (Material Value / Shipment Total) x GST Amount

Final Cost    = Purchase Value + Transportation Share + GST Share
Cost Per Unit = Final Cost / Quantity
```

Transportation and GST are never split equally — both are distributed in
proportion to how much each material contributed to the shipment's total
purchase value, exactly as specified.

## Project structure

```
index.html              Splash / entry point
dashboard.html + js/dashboard.js       KPI cards + charts + recent shipments
shipment.html + js/shipment.js         Shipment list, filters, add/edit modal
shipment-details.html + js/shipment-details.js   Full cost breakdown for one shipment
item-master.html + js/item-master.js   Item master CRUD
vendor-master.html + js/vendor-master.js  Vendor master CRUD
reports.html + js/reports.js           9 report types, print / Excel / PDF export
settings.html + js/settings.js         Company settings, DB connection, backup

css/style.css            White / Blue / Orange theme

js/db.js                 Excel read/write engine (File System Access API + fallback)
js/calc.js               Calculation engine (pure functions, no DOM)
js/validation.js         Field validators
js/ui.js                 Sidebar, topbar, toasts, confirm dialogs, formatting
js/utils.js              Shipment numbering, Excel/PDF export, misc helpers
js/connect.js            Database connection gate shown on every page

assets/js/               Vendored libraries (Bootstrap, SheetJS, Chart.js) — no CDN, no internet needed
assets/css/               Vendored Bootstrap CSS
excel/                    Suggested starting point for your Database folder
```

## Notes

- **Keyboard shortcut**: none of your existing data is ever deleted by the
  app automatically — deletes always require an explicit confirmation
  dialog.
- **Auto master-data**: typing a new vendor name or item name into a
  shipment automatically adds it to Vendor Master / Item Master too, so you
  rarely need to maintain those lists by hand.
- **PDF export** uses the browser's built-in print-to-PDF (via a print-
  formatted window) rather than a JS PDF library — this keeps the whole
  app dependency-light and fully offline.
- Best used in a Chromium-based browser (Chrome/Edge) for the smoothest,
  live-saving experience. It still fully works in Firefox/Safari via
  Upload/Download mode.
