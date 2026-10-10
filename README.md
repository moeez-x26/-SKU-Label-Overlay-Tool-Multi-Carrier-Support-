# SKU Label Studio

A complete browser-based dispatch workspace: upload an order sheet and a labels PDF, match parcels, edit and position SKU text, and download print-ready labels.

## Features

- CSV / TSV and XLSX order sheets, including multi-worksheet workbooks.
- Automatic column detection with editable mapping. Seller SKU is preferred over a platform SKU ID.
- Exact tracking or order ID matching; spaces and carrier hyphens are normalised without rounding long IDs.
- Recipient, postcode and address verification. A postcode alone never selects an order.
- Multiple item rows grouped by parcel, with quantities aggregated only for identical SKU strings.
- Conflict review for inconsistent tracking/order IDs, mismatched postcodes, invalid quantities, multiple labels for one parcel, and multiple parcel identifiers on a page.
- Interactive PDF preview, draggable SKU box, resize handle, keyboard movement, editable SKU/quantity text, font size, bold and alignment.
- Blank-space suggestions based on rendered page pixels, with collision and page-boundary checks before export.
- Apply formatting and position to labels with the same carrier and page dimensions while retaining each label's own SKU.
- Detect already printed SKU text: preserve it when it agrees with the sheet or deliberately replace it when it can be covered safely.
- Individual review and approval, batch approval of safe exact matches, and optional labels left unchanged.
- PDF export preserves page dimensions, orientation and original vector content/barcodes.
- Match report CSV including source row numbers, match evidence and final edits.
- Save/open a `.labelstudio` project with the original PDF, order sheet, matches and adjustments.
- Responsive layout, accessible controls, drag/drop file upload, progress and clear error messages.

## Privacy and architecture

Processing runs in the browser. There is no file upload endpoint, backend database, cloud AI service or API key. Customer files are not sent to Render or stored in the public repository. Uploaded files remain in tab memory; use Save project to keep a local resumable copy.

The app uses PDF.js for extraction and preview, PDF-LIB for export, and ExcelJS for XLSX parsing. Matching is deterministic rather than generative, so an uncertain match cannot invent a SKU.

## Run locally — no hosting account required

Install Node.js **22.22+** (or a newer LTS release), then download/clone this repository and open a terminal in its folder.

First-time setup:

```sh
npm ci
```

Start the app and automatically open your browser:

```sh
npm start
```

The app runs at `http://127.0.0.1:5173` (or the next available port). Keep the terminal open; press **Ctrl+C** to stop it. Dependencies are downloaded during first setup; processing requires no API key or paid service.

**Windows:** double-click `start-local.bat`. It installs dependencies if needed, starts the app and opens the browser.

**macOS/Linux:** run `bash start-local.sh` from the downloaded repository folder.

PDF fonts and supporting resources are prepared locally before launch, so label rendering does not rely on an external CDN.

For development and verification:

```sh
npm test
npm run build
npm run preview
```

## Render deployment

This is a Render Static Site. The static hosting tier has no paid compute service.

- Repository: this GitHub repository
- Branch: `main`
- Build command: `npm ci --no-audit --no-fund && npm run build`
- Publish directory: `dist`
- Node version: `22.22.0`

A `render.yaml` is included for reproducible configuration. Direct deployment through Render uses the same settings. No environment secrets are needed.

## Recommended daily workflow

1. Upload the order sheet and labels PDF.
2. Check the detected columns and click **Match orders to labels**.
3. Inspect matches, particularly any label in **Review**. The parcel dropdown shows source items and IDs.
4. Edit text and formatting, drag the text box, or use **Find blank space**. Resolve overlap warnings.
5. Approve each adjusted label, or use **Approve safe matches** for exact matches with safe suggested placement.
6. Download the match report and labels PDF. Print at **100% / actual size**.

If a label should remain unchanged, switch off **Add SKU to this label**. It stays in the exported PDF in its original position.

## Limits and review requirements

- Use one label per PDF page. Pages containing several recognised parcel identifiers require review; the app does not split an A4 sheet into individual labels.
- Image-only/scanned labels can be previewed and edited, but require manual parcel selection. There is no OCR guess.
- Text is exported in Helvetica or Helvetica Bold with standard Latin SKU characters. Unsupported characters are flagged rather than silently replaced.
- XLSX cannot recover IDs already rounded by Excel. Numeric IDs beyond safe precision are rejected; store identifiers as text.
- Masked names/addresses are supported when exact tracking/order IDs are available. Address-only matching requires unmasked, exact recipient and street data.
- Replacement covers the detected existing text area; it does not reconstruct obscured carrier print. If existing SKU text is already overlapping other text, use a clean original labels PDF.
- Blank-space checks detect existing ink; review the actual preview and carrier quiet zones before printing. No software can guarantee correctness for every possible unknown carrier template or damaged input file.
- Order sheets up to 30 MB, PDFs up to 80 MB / 1,000 pages, saved projects up to 150 MB. Large batches depend on available browser memory.
- Original page sizes and rotations are retained. Replaced old SKU strings may remain in the underlying PDF text layer; the visible area is covered, not securely redacted.

## Verification

Automated tests cover CSV parsing, long IDs, exact matches, conflicts, masked data, duplicate parcels, combined quantities, existing SKU checks, wrapping, bounds, unsupported characters and rotated-page export.

The supplied private sample batches were checked locally: **4/4** labels and **26/26** labels matched, with **29** source item rows grouped into **26** parcels. All **26** existing SKU overlays in the larger reference batch agreed with the source items and were preserved. The source samples are not included here.

Local batch QA can be run with your own files:

```sh
node scripts/check-batch.mjs /path/to/orders.csv /path/to/labels.pdf /path/to/check-output.pdf
```

This utility uses the optional Node canvas dependency supplied by PDF.js. It never copies source files into the repository.
