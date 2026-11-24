# QC Add-Ons — integration report

Sources: DOCX "388450 ASMARA QC App Add Ons" and prototype "QC+ Add-Ons Prototype v8.html" (both read in full).

## 1. Summary of changes
- `/requests` is untouched and is "QC Results". It gains a Home icon, All / Inspections / Sample evaluations chips, a NEW badge, due chips and a sample-evaluation card.
- Entry flow: Register/Login -> PIN -> Requests screen. A **New** button beside Sync opens a pop-up with New Sample Evaluation and New Inspection (no separate dashboard).
- New Inspection and New Sample Evaluation forms with the documented fields, defaults and validations.
- Mock server, IndexedDB and the request system extended (not replaced): `createRequest`, `fetchMasters`, `RequestsStore.add`, a masters cache.
- Triton items: group-wise defect Add / Delete, Default flag with Select Defects, Critical column, single-screen photo rename, report Download / Share.

## 2. Route structure
| Route | Screen |
|---|---|
| `/addons` | redirects to `/requests` |
| `/addons/inspection/new` | New Inspection |
| `/addons/sample-evaluation/new` | New Sample Evaluation |
| `/images` | Images page, opened from the floating image button: photos of saved drafts / submitted results with upload status, full-size view, Upload now |
| `/preview` | Screen preview tool: the real app in a resizable frame (phone / tablet / laptop / custom / full) with a screen switcher. Linked from Profile. |
| `/requests?tab=active\|completed&kind=inspection\|sample` | Request list (filters are in the URL, so they survive refresh) |
| `/requests/:id/orders/:oid/inspect/*` | Result screens (unchanged routes) |
| `/requests/:id/orders/:oid/report` | Report viewer (now with Download / Share) |

All routes are lazy and behind `appGuard`.

## 3. Components
Reused: TopBar, PhotoPicker / PhotoStrip, Confirm dialog, request card and list, repositories, LocalDb, Sync.
New: `AddonsHomePage`, `NewInspectionPage`, `NewSamplePage`, `addon-dialogs` (Article, Order, Copy, Worknote, Offer qty), `<app-qty-matrix>`, `PhotoRenameDialog`, `SelectDefectsDialog`, `ShareSheet`, `MastersStore`, rules `matrix.rule` and `defect-groups.rule`.

## 4. Business rules implemented
- Add order is locked until an article is chosen. Changing the article clears orders of the previous one. The order list is filtered by the article.
- Offer qty may not exceed ordered qty per cell. The cell is highlighted and OK is blocked.
- Messages: "Select an Article no. before creating the inspection." / "Add at least one production order." / "Select an Inspection type." / "Select an Article no. before creating the evaluation." / "Select a Sample type."
- Creation needs to be online. Request numbers are IR- / SE-. The new request appears in Active with a NEW badge.
- Defects come from the QC Defects master. Default entries are pre-selected and locked. Critical comes from the master for master rows. It is toggleable only for manually added rows. A final OTHER DEFECTS group holds free text.
- Legacy "others" defects are migrated into that group.

## 5. Testing
- Unit tests: 52 passing (4 files), including matrix, defect-group and matrix-order form rules.
- Browser journeys checked: `/requests` regression; Home; New Inspection (article, auto-fill, order, offer matrix over-ordered / match / clear / bulk fill, create, redirect, NEW badge); open result (summary rows come from the matrix); defects (Add, Select Defects, Delete, Critical); New Sample Evaluation (validations, type, worknote, grid, create, card, refresh); report Download and Share sheet.
- Not browser-tested: photo rename dialog, Copy from PWN / existing, Rows mode of the sample grid, the native device-share sheet (no device here).

## 6. Build
`ng build` passes. Initial bundle is under budget; the component-style warning budget was raised to 6 kB.

## 7. Not implemented (and why)
| Item | Reason |
|---|---|
| By-colour summary drill-down, N/A quality option, Hold judgement, AQL sample allocation, "Critical (proposed)" total | In the prototype only; not in the DOCX, so not an agreed rule |
| Dark theme, mobile bottom tab bar, pull-to-sync | Prototype chrome, not in the DOCX; the app keeps its own shell |
| Login screen replacement | The app keeps its own registration / PIN |
| Admin page / sidebar | Does not exist in this app; Home is reached from the Requests header and Profile |
| Result entry for sample evaluations | Not in the spec |
| Vercel deployment | Paused: needs `vercel login` or `vercel deploy --temporary` from the user |
