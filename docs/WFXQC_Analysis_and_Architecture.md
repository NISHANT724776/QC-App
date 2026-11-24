# WFX Quality Controller → Angular: Analysis & Architecture (Phase 1–3 deliverable)

Status: **DRAFT FOR REVIEW — no application code has been written.**
Sources analysed: `WFXQC-ScreenShot.docx` (59 screenshots, all viewed) and `WFXQCPlus App(Xaml_Code).docx` (≈5,000 lines of .NET MAUI XAML, 13 portrait pages + 11 landscape variants, plus the WFX logo).

---

## 0. Read this first — what the documents do and do not contain

The brief describes DOCX files containing "functional specifications, workflows, business rules, transaction rules". **The two files provided contain none of that as prose.** They contain:

| Source | What it gives me | What it does NOT give me |
|---|---|---|
| Screenshots (59) | Real screens in portrait (phone) and landscape (tablet), with real sample data (IR-7300/7302/7303, order 114081, POM list, defect list, checklists) and several state transitions (e.g. IR-7302 moving Active → Completed, sync icon red → green) | Any text explaining rules, error messages, or edge cases |
| XAML (MAUI) | Every field, label key, binding name, MaxLength, keyboard type, which blocks are conditionally visible (flags), event handler names, the original developers' performance notes | **Code-behind, ViewModels, API contracts, calculation code, localization strings (`.resx`), validation messages.** The `*_Clicked` / `*_TextChanged` handlers are named but their bodies are not included |

**Consequence:** the screens, fields, layout and the *existence* of many rules are known with high confidence. The *exact formulas and validations* (sample-size lookup, defect equivalence, tolerance maths, submit gating, mismatch rule, API shape) are **not** in the material. Per your instruction not to invent rules, every rule below is tagged:

- **[C] Confirmed** — directly visible in a screenshot or XAML attribute
- **[I] Inferred** — strongly implied by data/behaviour in screenshots; needs your confirmation
- **[?] Unknown** — a clarification is required (listed in §12)

Also note: the screenshots contain a UAT URL and a user id. I treated them as sample data only and will not call that environment; all development will use the mock API layer.

---

## 1. Understanding of the existing application

**WFX Quality Controller (v6.4)** is a cross-platform (.NET MAUI, Android/iOS) **field app for garment Quality Controllers (QCs)** working for World Fashion Exchange. A QC visits a factory, opens an assigned **Inspection Request** (e.g. a *Final Inspection* for a style from a supplier), records the inspection result in a structured multi-section form, captures photos and two signatures, and submits. A PDF report is then available and can be emailed.

Key characteristics that shape the rebuild:

1. **Multi-tenant "device registration"** — the user registers the app with *username, password, company ID and company URL* (each client has its own server). A 4-digit **PIN** (and optional biometric) then protects daily access. *(C)*
2. **Pull/push synchronisation** — a **Sync** button with *Last Sync* time; completed results show a per-order sync indicator (red = not yet synced, green = synced) and a "pending image uploads" counter badge. *(C/I)*
3. **Server-driven forms** — the inspection form is largely *configured by the server*: tabs come from `EvaluationGroup` data, checkpoints/sub-checkpoints/judgement options/actual-value columns/comments/attachments are all toggled by flags (`IsCheckPointEnabled`, `IsJudgementEnabled`, `ShowActualValueColumn`, `IsAttachmentsEnabled`, `MicroDefectEnabled`, `ShowAcceptedLimit`, `CaptureAccepted/Seconds/Scrap` …). *(C)* This is the single most important design implication: **the Angular app must be a renderer of configuration, not a set of hard-coded screens.**
4. **Two parallel UIs** — portrait and a separate landscape ("Ls") XAML set, switchable in profile ("Landscape Layout" toggle → app restart). A responsive web design replaces this duplication (needs your approval, see §12 Q-18).
5. **Heavy on-device performance work** — XAML comments record ANR (app-not-responding) fixes: virtualised lists, removal of nested scroll views, replacing native Pickers with popup lists. *(C)* → virtualisation is a hard requirement for the web rebuild too.
6. **Evidence capture** — camera/gallery attachments at request, RA sheet, defect, evaluation-area and final-result level, with "Optimize Image" compression; hand-drawn **QC and Factory-Representative signatures**. *(C)*
7. **Localised** — all labels use translation keys; language picker in profile; data contains Spanish text (e.g. "Botón extra", RA sheet risks). *(C)*

---

## 2. Module & screen inventory

### 2.1 Module hierarchy

```
A. Access            A1 Registration  ·  A2 PIN (create / login / biometric)
B. Requests          B1 Request list (Active | Completed)  ·  B2 Search  ·  B3 Date filter (calendar, Day/Week/Month)
                     B4 Request card (expand: orders, comment, attachments)  ·  B5 Cancel request  ·  B6 Report viewer (PDF + email)
                     B7 Sync (+ pending-upload counter)
C. Inspection Result C1 Summary  ·  C2 RA Sheet  ·  C3 Measurement Evaluation  ·  C4 Measurement Results (custom)
  (per order)        C5 Defect Capturing  ·  C6 Quality Results (custom)  ·  C7 Packing Results (custom)  ·  C8 Final Result
D. Profile/Settings  D1 Profile  ·  D2 System diagnostics overlay  ·  D3 Report a bug  ·  D4 Unregister
E. Shared UI         Snackbar · loader overlay · calendar dialog · selection-list popup · attachment sheet (Gallery / Camera)
                     · image strip (per-defect) · signature pad · info/confirm dialog · "No data" empty state
```

### 2.2 Screen inventory (every screen/state seen)

| # | Screen | Screenshots | XAML | Key elements |
|---|---|---|---|---|
| A1 | Registration ("Welcome") | 1, 38 | WFXQCRegistration | Username (auto-lowercase), Password (masked), Company ID (auto-lowercase), Company URL (auto-lowercase), arrow submit, green snackbar "Login successfully", busy spinner, footer "World Fashion Exchange All Rights Reserved." (tappable) |
| A2 | Enter PIN – create | 2, 39 | WFXQCEnterPin | PIN + Confirm PIN (4-digit, numeric, masked), create-login button, "Enable Touch/Face ID" link |
| A2' | Enter PIN – login | — (state implied by `IsLoginVisible`, `IsConfirmPinVisible`) | same | PIN only, login button, biometric icon/label |
| B1 | Request list – Active | 3, 7, 40, 44 | WFXInspectionRequest | Tabs, search, calendar icon, date-grouped cards, Sync bar, *Last Sync*, version, pending-upload badge |
| B1' | Request list – Completed (empty / populated) | 4, 41, 22, 23, 58, 59 | same | "No Data Found!" illustration; green status dot, green left bar on order, PDF icon, sync icon |
| B3 | Calendar dialog | 5, 42 | (popup) | Month nav, Sun–Sat grid, today ring, yellow dots on dates having requests, Cancel/OK |
| B1-L | Request list – landscape | 25, 26, 27, 37 | WFXInspectionRequestsLs | Prev/next range arrows, Day/Week/Month segmented control, inline search, calendar, ⋮ menu (View Active / View Completed), richer order table |
| B4 | Expanded card | 7, 26, 44 | | Order table, comment, attachment links (PDFs) |
| D1 | User Profile | 6, 43 | WFXUserProfile(Ls) | Logged in as, 4 toggles, language, company URL, PIN, Update, Unregister, Report a bug, System Diagnostics, version |
| D1' | Restart-info dialog | 24 | | "The app will restart to apply the new settings." Cancel / Confirm |
| C0 | Inspection Result shell | 8–21, 28–36, 45–57 | WFXInspectionResult(Ls) | Back, avatar, scrollable tabs (data-driven `TabVms`), "Loading…" |
| C1 | Summary | 8, 28, 45 | WFXSummary(Ls) | see §5 |
| C2 | RA Sheet | 9, 29, 46 | WFXRASheet(Ls) | Activity / Risk / Action Required / attachment link / Comments |
| C3 | Measurement Evaluation | 10, 30, 31, 47 | WFXMeasurement(Ls) | Size tabs, POM grid, samples, colour per sample, "+" add sample |
| C4 | Measurement Results | 11, 32, 48 | WFXCustomPage(Ls) | Comments + Result dropdown |
| C5 | Defect Capturing | 12, 18, 33, 49, 54 | WFXDefectCapturing(Ls) | Grouped defect grid, counters, attach, totals, limits |
| C5' | Defect attachment dialog + sheet + camera/gallery | 13–17, 50–53 | | Title, Upload/Save/Cancel, per-image comment, delete badge |
| C6 | Quality Results | 19, 34, 55 | WFXCustomPage(Ls) | "Quality Checklist" |
| C7 | Packing Results | 20, 35, 56 | WFXCustomPage(Ls) | Sections Folding / Trims / Cartons + photos + Result |
| C8 | Final Result | 21, 36, 57 | WFXFinalResult(Ls) | Photos, Judgement date + Judgement, remarks, 2 signatures, Discard/Save/Submit |
| C8' | Signature overlays (QC, FR) | (XAML) | `QCSign`, `FRSign` | Pad, Clear, OK |
| B6 | Report viewer | (XAML only) | WFXReportView(Ls) | PDF view, Back, "Send email", snackbar "sent as email" |

Screens **seen in XAML but not in any screenshot**: Report viewer, signature overlays, system-diagnostics overlay content, selection-list popups, mismatch banner on Final Result, "Add defect" (Other defect) UI, Final-Result Accepted/Second/Scrap grids. Their behaviour is therefore *[I]*.

---

## 3. End-to-end workflows

### 3.1 Primary workflow (from the screenshots' timestamps and states)

```
Register device (A1) ──► Create PIN (A2) ──► [daily] PIN/biometric login ──► Request list (B1)
       │                                                                          │
       └─ Unregister (D1) resets ◄── Profile (D1)                                 ▼
                                                              Sync ◄──► Server (requests + master data)
                                                                          │
                              Tap order no. (e.g. 114081) opens Inspection Result for that order
                                                                          ▼
 Summary → RA Sheet → Measurement Evaluation → Measurement Results → Defect Capturing
        → Quality Results → Packing Results → Final Result ──► Submit Result
                                                                          ▼
                       Request moves Active → Completed (IR-7302 observed: 10:46 Active → 10:51 Completed)
                       Order row shows sync icon: RED (saved on device) → Sync → GREEN (on server)
                                                                          ▼
                                      PDF icon → Report viewer → Send as email
```

### 3.2 Per-transaction analysis (your 10-point template) — Inspection Result for one order

| Point | Detail |
|---|---|
| 1 Starting point | Request list → expand card → tap **Order No.** link (`QARequestOrderID`) |
| 2 Required master/config data | Inspection standard list (e.g. 1.5), colour/size matrix & ordered qty, RA sheet rows, POM list per size with required/tolerance, defect catalogue grouped (Appearance…), acceptable limits, evaluation groups/areas/checkpoints/judgement options, scrap/second defect types, supplier/article metadata |
| 3 User inputs | Offered/Inspected qty per colour×size, Cartons Offered/Inspected + carton numbers, RA comments, measurement actuals per sample + colour, defect counts/remarks/photos, checkpoint judgements/comments/photos/actual values, group results, accepted/second/scrap qty, judgement date + judgement + remarks, 2 signatures |
| 4 Field validations | §5 matrix |
| 5 Business rules | §4 |
| 6 Processing | Each tab has its own **Save** (persist section); **Submit Result** only on Final Result tab; results synced to server; report generated |
| 7 Output | Completed request, sync status, PDF report (emailable) |
| 8 Next action | View/email report; re-sync if red; (re-open/edit? **[?]**) |
| 9 Dependencies | §6 |
| 10 Status changes | Active (grey dot) → Completed (green dot, green bar); sync red → green; Cancel (✕) when `IsInspectionCancel` |

---

## 4. Extracted business & transaction rules

Rule IDs are stable references for the later test matrix.

### Access
| ID | Rule | Tag |
|---|---|---|
| BR-A1 | Registration needs Username, Password, Company ID and Company URL; username, company ID and URL are lower-cased | C |
| BR-A2 | Successful registration shows "Login successfully" and proceeds to PIN | C |
| BR-A3 | PIN is exactly 4 numeric digits, masked; first time requires Confirm PIN; subsequent logins use PIN only | C (length/mask) / I (match rule) |
| BR-A4 | Biometric login is optional and user-controlled (PIN-screen link + Profile toggle) | C |
| BR-A5 | Unregister removes the device registration (data purge scope unknown) | C / ? |
| BR-A6 | Changing language / layout / optimise-image etc. requires app restart (confirm dialog) | C |

### Requests
| ID | Rule | Tag |
|---|---|---|
| BR-R1 | Requests are split Active vs Completed and grouped under a date heading; sorted by date | C (group) / ? (which date field) |
| BR-R2 | Search filters the list as the user types (`TextChanged`) | C (fields searched ?) |
| BR-R3 | Calendar highlights dates that have requests (yellow dot); selecting a date filters | C / I |
| BR-R4 | Status dot: grey = pending, green = completed | C |
| BR-R5 | "+N" badge when the request has multiple styles (`MultiStyleVisibility`, `StyleCount`) | C |
| BR-R6 | Card is expandable only when `IsExpanderEnable` | C |
| BR-R7 | Cancel (✕) appears only when `IsInspectionCancel` is true | C (effect ?) |
| BR-R8 | Completed rows show PDF (report) and sync icon (`SyncIconVisibilty`); red→green after successful sync | C / I |
| BR-R9 | Landscape adds Day/Week/Month range navigation and extra columns (Color, Ordered, Offered, A.Offered, Accepted, Delivery date, Status) | C |
| BR-R10 | A pending-image-upload badge counts queued attachments | C / ? |

### Summary tab
| ID | Rule | Tag |
|---|---|---|
| BR-S1 | Per colour×size row: Ordered (read-only), Offered (editable), Inspected (editable) | C |
| BR-S2 | Total row sums Offered and Inspected (observed 12 / 1); landscape also row/column sums and total Ordered | C |
| BR-S3 | **Variance = Inspected total − Sample Size** (observed: 1 − 3 = −2) | I |
| BR-S4 | **Sample Size** is derived from the selected Standard and the offered quantity (observed: Standard 1.5, offered 12 → 3) via a lookup table not provided | I / ? |
| BR-S5 | Landscape shows *Original Standard* (read-only) and *Revise Standard* (selectable); portrait shows a single *Standard* picker | C (conflict → ?) |
| BR-S6 | Cartons Offered ≤ 9 digits, Cartons Inspected ≤ 3 digits; entering Cartons Inspected = N generates N carton-number inputs (placeholders c1…cN, 3 per row) | C / I |

### RA Sheet
| BR-RA1 | Rows are fixed activities (Route, Cutting, Sewing, Print, Embroidery, Laundry/Dye, Finishing, Fabric) with server-supplied Risk and Action Required (read-only); QC enters Comments only; attachment icon highlights when attachments exist and opens them | C |

### Measurement
| ID | Rule | Tag |
|---|---|---|
| BR-M1 | One tab per size; each POM row shows Required, +Tol, −Tol | C |
| BR-M2 | Values are fractional inches ("22 1/2", "1/4", "3/8") | C |
| BR-M3 | An Actual outside Required ± tolerance is shown red (10 vs 22 1/2 ±1/4 → red; 20 1/2 vs 20 1/2 → normal) | I |
| BR-M4 | Samples are added with "+" (landscape: columns Actual 1/2/3, each with a **colour** selector; samples deletable) | C |
| BR-M5 | POM may be flagged `Critical` | C / ? |
| BR-M6 | Highlight evaluated when the entry loses focus (`Unfocused`) | C |

### Defects
| ID | Rule | Tag |
|---|---|---|
| BR-D1 | Defects are grouped (e.g. APPEARANCE); each row: Remarks, Major count, Minor count, optional Micro count, attachments | C |
| BR-D2 | Counters via − / + buttons or typed; values ≥ 0 | C / I |
| BR-D3 | Footer: Actual Major / Minor (/Micro) / Total; Total = sum | C |
| BR-D4 | If `MajorMinorSubstitutionEnabled`, an "Eq. Total" row (EqMajor/EqMinor/EqTotal) is shown — conversion ratio unknown | C / ? |
| BR-D5 | If `ShowAcceptedLimit`, an "Ac. Limit" row (Major/Minor/Micro/Total) is shown; source (standard × sample size) unknown; no visible pass/fail effect | C / ? |
| BR-D6 | `Critical` defects carry a visual marker | C |
| BR-D7 | Photos per defect: dialog titled with defect name; Upload → (Gallery / Take Photo) → thumbnails with delete badge and per-photo comment → Save/Cancel; icon turns teal when photos exist | C |
| BR-D8 | QC may add "Other" defects (name + counts + photos), and delete them | C (XAML: `deleteOtherDefect`, `Defect_AddDefect`) |

### Evaluation (Quality / Packing / Measurement Results)
| ID | Rule | Tag |
|---|---|---|
| BR-E1 | Structure: Evaluation **Group** (tab) → **Area** (section heading) → **Checkpoint** (+ optional **Sub-checkpoint**) | C |
| BR-E2 | Each level has optional judgement (`IsJudgementEnabled`, `IsEvaluationGroupJudgementEnabled`), comments (`IsCommentEnabled`), attachments (`IsAttachmentsEnabled`); checkpoints optionally have an Actual value column (`ShowActualValueColumn`, `IsActualReadonly`) | C |
| BR-E3 | Checkpoint judgement values seen: *Select*, *Confirmed*, *No Confirmed*; area/group Result seen: *Approved*, *Rejected* | C |
| BR-E4 | **Group Result is chosen manually** — observed Packing Result = "Approved" with "Check all Carton Number = No Confirmed" (portrait) and Result = "Rejected" with several unset checkpoints (landscape). No auto-calculation visible | C / ? |

### Final Result
| ID | Rule | Tag |
|---|---|---|
| BR-F1 | Optional quantity capture blocks shown only when `CaptureAccepted` / `CaptureSeconds` / `CaptureScrap` | C |
| BR-F2 | Accepted: colour×size; Second & Scrap: defect-type×colour×size; each with totals | C |
| BR-F3 | A hidden banner (`OfferQtyCheck`, "AcceptedQtyMismatch" message) with an **Update** action appears on a quantity mismatch — trigger and update semantics unknown | C / ? |
| BR-F4 | Judgement Date defaults to today, read-only display with calendar button | C |
| BR-F5 | Judgement chosen from a popup list (seen: *Approved*) + free-text remarks | C |
| BR-F6 | Two signatures (QC, Factory Rep): tap to open pad, Clear, OK; edit icon appears once signed | C |
| BR-F7 | Save persists; **Submit Result** finalises → request becomes Completed | C / I |
| BR-F8 | Gating on Submit (all tabs saved? signatures/judgement mandatory?) | ? |

### Cross-cutting
| ID | Rule | Tag |
|---|---|---|
| BR-X1 | Every tab has Discard (red) and Save (gradient) | C |
| BR-X2 | A "no internet connection" snackbar exists on every transactional page → network-dependent operations (sync/save/upload?) | C / ? |
| BR-X3 | Images may be compressed ("Optimize Image") before upload | C / ? |

---

## 5. Field-level validation matrix

"Req." = required. Only attributes **evidenced in XAML/screenshots** are filled; `?` = needs your confirmation.

| Screen | Field | Type / control | Constraint evidenced | Req. |
|---|---|---|---|---|
| Registration | Username | text | lower-case transform | ? |
| | Password | text | masked | ? |
| | Company ID | text | lower-case | ? |
| | Company URL | text | lower-case, text-prediction on; http(s) URL format | ? |
| PIN | PIN | numeric | **max 4**, masked, `TextTransform=Lowercase` | yes (implied) |
| | Confirm PIN | numeric | **max 4**, masked; must equal PIN **[I]** | yes (create) |
| Profile | Language | picker | default "English (Default)" | — |
| | Company URL / PIN | text / numeric | same as above (max 4) | ? |
| | Toggles (Notification, Biometric, Optimize Image, Landscape) | switch | — | — |
| Request list | Search | text | live filter | — |
| | Date | calendar | month nav; dots on dates with data | — |
| Summary | Standard / Revise Standard | popup list | one value (e.g. 1.5) | ? |
| | Offered (per colour×size) | numeric (`Telephone` keyboard) | whole number ≥ 0 **[I]** | ? |
| | Inspected (per colour×size) | numeric | whole number ≥ 0 **[I]**; ≤ offered? **[?]** | ? |
| | Cartons Offered | numeric | **max 9 digits** | ? |
| | Cartons Inspected | numeric | **max 3 digits**; drives carton-number inputs | ? |
| | Carton no. 1…N | text/numeric | `KeyboardType` and `ReturnType` set per item (value from server/VM) | ? |
| RA Sheet | Comments | text | free text | no |
| Measurement | Actual (per POM × sample) | text (fraction) | fractional inch format; compared with tolerance | ? |
| | Sample colour | popup list | colours of the order | ? |
| Defects | Major / Minor / Micro | numeric (`Numeric`) | integer ≥ 0 | no (default 0) |
| | Remarks | text | placeholder "Enter your remarks" | no |
| | Photo comment | text | per photo | no |
| | Other defect name | text | "Enter defect name" | yes when added **[I]** |
| Evaluation | Judgement | popup list | Select / Confirmed / No Confirmed | ? |
| | Actual value | text | read-only when `IsActualReadonly` | ? |
| | Comments | text | free text | no |
| | Group Result | popup list | Approved / Rejected / … | ? |
| Final Result | Accepted / Second / Scrap qty | numeric | whole number; totals computed; mismatch check | ? |
| | Judgement date | date | defaults today, not directly editable | yes |
| | Judgement | popup list | e.g. Approved | yes **[I]** |
| | Remarks | text | placeholder "Enter your remarks" | ? |
| | QC / FR signature | drawing | non-empty to be "signed" | ? |

---

## 6. Inter-module dependencies

```
Sync ──► Requests, orders, colour/size matrix, standards, RA rows, POM tables, defect catalogue,
         evaluation config, limits, judgement lists, scrap/second defect types, translations(?)
Registration(Company URL + ID) ──► base API address for EVERY other call (multi-tenant)
PIN/Biometric ──► gates all screens;  Profile edits URL/PIN/language ──► restart
Summary (colour×size, Offered/Inspected, Standard, Sample Size)
   ├─► Defect "Ac. Limit" (inferred from standard + sample size)
   ├─► Final Result Accepted/Second/Scrap grids (same colour×size keys: QARequestOrderColorSizeID)
   └─► Measurement colour list (order colours)
Defect "Other" defect names ─► Final Result "Defect type" for Second/Scrap (inferred)
Measurement (size tabs) ─► sizes in order;  POM tolerance ─► red highlight
Evaluation groups (config) ─► which tabs exist; flags ─► which blocks render
All tabs Save ─► local draft ─► Submit ─► Sync (red→green) ─► Report PDF ─► Email
Attachments (all levels) ─► upload queue ─► badge count; "Optimize Image" ─► compression
Profile "Landscape" toggle ─► replaced by responsive layout (needs approval)
```

---

## 7. Proposed Angular architecture

**Versions** — environment has Node v22.23 / npm 11.17; Angular CLI is not installed. I will scaffold with the **latest stable Angular** supported by this Node (verified at `ng new` time and recorded), standalone APIs, **signals + zoneless-ready + OnPush**, new control-flow syntax, Angular Material (M3 theme) + CDK, SCSS.

| Concern | Decision | Why |
|---|---|---|
| Structure | Standalone components, **feature areas lazy-loaded by route**, `core / shared / features` layering | Requested; keeps modules independent |
| State | Signal-based **feature stores** (plain injectable services with `signal/computed`), RxJS only for HTTP, search debounce, sync queue | Avoid heavy deps; forms are local, drafts persisted |
| Forms | **Reactive Forms**, `FormArray` for grids, typed forms; **dynamic form engine** for evaluation groups | Server-driven checkpoints (BR-E*) |
| Data layer | Domain **repository interfaces** (`InspectionRepository`, `AuthRepository`, `SyncRepository`…) bound via `InjectionToken` to either `Http*` or `Mock*` implementations selected by `environment` | "Clearly separated mock layer, replaceable without UI rewrite" |
| API/Errors | Functional interceptors: base-URL (tenant), auth, retry/back-off, **central error → snackbar**, loading counter | Centralised handling |
| Offline & sync | **PWA service worker + IndexedDB** (drafts, outbox, image queue); `SyncService` pushes outbox → pulls masters; drives red/green sync icon and pending-upload badge | Mirrors Sync/Last-Sync/badge behaviour; QCs work in factories |
| Config-driven UI | `EvaluationRenderer` interprets `EvaluationGroup → Area → CheckPoint` + flags; no per-group components | Matches server-driven XAML |
| Grids | CDK virtual scroll for defects/POMs/requests; sticky first column; tabular numeric inputs | Original ANR lessons |
| i18n | **Transloco** (runtime switch, no restart), key names reused from the XAML (`Request_Title`, `Defect_Major` …) | Keys already exist; avoids restart |
| Signature | `signature_pad` (≈10 KB) lazy-loaded in a dialog | Light |
| PDF | Native browser PDF (`<iframe>/<object>` with blob URL) first; pdf.js only if needed | Avoid large lib |
| Biometric | **WebAuthn** (platform authenticator) as the Touch/Face ID equivalent | Web-appropriate |
| Images | Canvas-based compression honouring "Optimize Image"; EXIF-safe; `<input capture>` / `getUserMedia` for camera | Replace MAUI media picker |
| Testing | Vitest/Jasmine units for pure rule services (variance, tolerance, totals), Playwright e2e for the workflow | Rules isolated from components |
| Quality gates | ESLint, strict TS, bundle budgets, a11y checks | Maintainability |

### 7.1 Route map (lazy)

```
/register                      access/registration
/pin                           access/pin
/requests                      requests/list   (?tab=active|completed&date=&range=day|week|month&q=)
/requests/:requestId/orders/:orderId/inspect          shell (stepper)
      .../summary  .../ra-sheet  .../measurements  .../defects  .../evaluation/:groupId  .../final
/requests/:requestId/orders/:orderId/report           report viewer
/profile                       settings/profile
/diagnostics                   (dialog route)
```
Guards: `registeredGuard` → `pinGuard`; `canDeactivate` unsaved-changes guard on the inspection shell.

### 7.2 Folder structure

```
qc-app/
├─ src/
│  ├─ app/
│  │  ├─ core/            # singletons: auth, tenant-config, api (interceptors), sync, storage(indexeddb), i18n, error handler, guards
│  │  ├─ domain/          # typed models + pure rule services (NO Angular UI)
│  │  │   ├─ models/      # InspectionRequest, OrderLine, ColorSize, Pom, DefectGroup, EvaluationGroup/Area/CheckPoint, …
│  │  │   └─ rules/       # sample-size.rule, variance.rule, tolerance.rule, defect-totals.rule, quantity-reconcile.rule
│  │  ├─ data/            # repositories: *.repository.ts (interfaces+tokens), http/, mock/ (+ fixtures from screenshots)
│  │  ├─ shared/          # ui kit: app-shell, data-table, counter-stepper, fraction-input, status-dot, signature-dialog,
│  │  │                   # attachment-picker, image-strip, selection-list, date-range-bar, empty-state, snackbar, loader
│  │  ├─ features/
│  │  │   ├─ access/       (registration, pin)
│  │  │   ├─ requests/     (list, card, calendar-filter, report-viewer)
│  │  │   ├─ inspection/   (shell, summary, ra-sheet, measurements, defects, evaluation, final-result, store)
│  │  │   └─ settings/     (profile, diagnostics)
│  │  ├─ app.routes.ts · app.config.ts
│  ├─ environments/       # environment.ts / .development.ts / .production.ts (mock vs http flags)
│  ├─ assets/ i18n/ (en, es, …)   ·   styles/ (tokens, theme, mixins, utilities)
├─ e2e/   ·   docs/   ·   angular.json · ngsw-config.json
```

---

## 8. UI/UX improvement recommendations (functional behaviour unchanged)

1. **Inspection shell with progress rail** — replace a 9-tab strip (cut off on phones) with a stepper/side-rail showing per-section *status chips* (Not started · In progress · Saved · Issue). Sections mirror today's tabs exactly; order preserved.
2. **Sticky live summary bar** — Offered / Inspected / Sample size / Variance and defect totals vs limit visible on every section (same numbers as BR-S2/S3, BR-D3/D5).
3. **Request list as agenda + cards** — Day/Week/Month segmented control and calendar dots become available on *all* sizes (today only landscape/tablet); status as chip + dot; timeline of status (Requested → Inspected → Submitted → Synced) inside the expanded card.
4. **Measurement matrix** — sticky POM column, tolerance shown as a range chip (`22 ½ ± ¼`), out-of-tolerance cells flagged with colour **plus icon** (not colour alone); fraction-aware input with ¼ ⅛ ⅜ quick-keys; sample columns with colour chips.
5. **Defects** — large-tap steppers; Major/Minor/Micro as segmented counters on mobile (card per defect), table on desktop; photo count badge on each card; totals pinned.
6. **Evaluation forms** — chip toggles (✓ Confirmed / ✕ Not confirmed / – N/A) instead of dropdown *when the judgement list is ≤ 3 options* (still driven by the server list).
7. **Final Result** — readiness checklist ("Summary saved · Defects saved · Photos · Judgement · QC signature · FR signature") shown before **Submit**; signatures in a full-screen dialog with Clear/OK.
8. **Drafts** — autosave per section to IndexedDB; Save/Discard keep their meaning; Discard asks for confirmation.
9. **Status & feedback** — consistent snackbar, skeleton loaders (instead of blocking overlays), meaningful empty states (reuse the "No Data Found!" artwork).
10. **Accessibility** — 44 px targets, focus order, ARIA on custom controls, colour-independent states, light/dark ready tokens.
11. **Design tokens** — retain WFX brand (teal `#2aa1b1`→blue gradient, white cards, Open Sans) and logo as the baseline theme; refine spacing/typography scale.
12. **Data hygiene** — escape bug displays `6\"` instead of `6"`; labels like "No Confirmed" and "FInishing" look like typos — will be surfaced for your decision, not silently changed.

---

## 9. Responsive design strategy

Breakpoints (CDK `BreakpointObserver` + CSS container queries): **XS <600 · SM 600–959 · MD 960–1279 · LG 1280–1919 · XL ≥1920**.

| Area | XS (phone) | SM/MD (tablet / laptop) | LG/XL (desktop) |
|---|---|---|---|
| Navigation | bottom sync bar + top app bar; inspection rail becomes a horizontal chip scroller | collapsible rail | permanent side rail + summary bar |
| Request list | single-column cards, calendar as full-screen dialog | 2-column cards, inline Day/Week/Month | master-detail: list left, expanded order table right |
| Order/summary matrix | per-size cards (colour rows inside) | matrix with sticky colour column | full matrix with row/column totals |
| Measurement | one size per screen, one sample visible, swipe samples | sticky POM col, 3 samples | all samples |
| Defects | card per defect | compact table | full table + limit/totals footer |
| Evaluation | stacked rows | 2-column areas | 2–3 column areas |
| Signatures / dialogs | full-screen | modal | modal |
| Tables overflow | controlled horizontal scroll with sticky first column & scroll shadows | — | — |

The portrait/landscape pair of XAML sets collapses into **one responsive implementation**; the "Landscape Layout" toggle is proposed for retirement (needs approval).

---

## 10. Performance strategy

- **Routes lazy-loaded**; signature, PDF, calendar, camera code split with `@defer`.
- **OnPush + signals/zoneless-ready**; `computed()` for totals/variance/tolerance (no template functions).
- **Virtual scrolling** for requests, POM rows, defect rows (original app needed this to avoid ANR — XAML comments).
- **Server-side pagination + date-window queries** for requests; **debounced (300 ms)** search; `switchMap` cancellation.
- `@for … track` on stable ids (`QARequestID`, `POMCode`, `DefectID`, `QARequestOrderColorSizeID`).
- **Draft writes debounced** to IndexedDB; sync outbox batched; images compressed client-side and uploaded sequentially with retry.
- Image thumbnails via `loading="lazy"` + downsampled previews (original used 250 px downsample).
- Budgets: initial JS ≲ 200 KB gz; per-route chunks ≲ 100 KB; Lighthouse PWA ≥ 90 as a gate.
- No UI kit beyond Material/CDK; only 2 small third-party libs (signature pad, Transloco).

---

## 11. Phases & tracking

| Phase | Output | Status |
|---|---|---|
| 1 Documentation analysis | this document | ✅ done |
| 2 Requirement mapping | §2–6 | ✅ done (rules marked C/I/?) |
| 3 Architecture & UI planning | §7–10 | ✅ proposed — **awaiting your approval** |
| 4 Development | scaffold → shell → access → requests → inspection (summary → RA → measurement → defects → evaluation → final) → settings | ⏸ blocked on approval + Q-1…Q-6 |
| 5 Test & optimise | workflow, validation, rules, responsive, perf | ⏸ pending |

Proposed build order after approval: scaffold + design system + mock data (seeded from the screenshots) → access → request list → inspection shell + Summary → Measurement → Defects → Evaluation renderer → Final Result/signatures/submit → Report & sync → Profile → hardening.

---

## 12. Missing information & clarification questions

### Blocking (needed before/while building core flows)

| # | Question |
|---|---|
| Q-1 | **Source gap:** can you supply the ViewModels/code-behind (or API/Swagger, DTOs, `.resx` localisation files, and any functional spec)? Without them every rule marked [I]/[?] is a guess. |
| Q-2 | **Target:** is the Angular app a *replacement* for the MAUI mobile app, or a *web companion*? Is it used on phones/tablets in factories (⇒ PWA with camera + offline) or mainly on desktops? |
| Q-3 | **Backend:** do REST endpoints exist for login, requests, masters, save, submit, upload, report, email? Auth scheme (token/session)? CORS enabled for a browser? Otherwise I build against mocks only. |
| Q-4 | **Offline:** must a QC be able to inspect with no connectivity (the XAML shows "no internet" snackbars on every page, which suggests *online-required* for some actions)? Which actions need the network? |
| Q-5 | **Sample Size & Standard:** list of standards (AQL values), the lookup table (standard × offered qty → sample size), and the exact Variance formula (I infer Inspected − Sample Size). |
| Q-6 | **Defect rules:** source and formula of "Ac. Limit" (Major/Minor/Micro/Total), the Major/Minor substitution ratio behind "Eq. Total", whether exceeding limits or any *Critical* defect forces *Rejected* or only warns. |

### Important (rules)

| # | Question |
|---|---|
| Q-7 | **Measurement:** exact tolerance test (inclusive?), fraction input format (accept decimals?), minimum/maximum samples, is an Actual mandatory, what does `Critical` on a POM change? |
| Q-8 | **Results/judgements:** full lists for checkpoint judgement, area/group Result and final Judgement (Approved/Rejected/Hold/…?). Is Result ever auto-derived (screens show it is manual)? |
| Q-9 | **Submit gating:** what must be complete before *Submit Result* (all tabs saved? signatures? judgement?). Can a Completed result be reopened/edited? |
| Q-10 | **Final Result quantities:** what controls `CaptureAccepted/Seconds/Scrap`, what triggers the *Accepted-qty mismatch* banner, and what does **Update** do? |
| Q-11 | **Request semantics:** which date drives the date groups/calendar dots (inspection date vs due vs delivery)? What does **Cancel (✕)** do (API, confirmation)? Meaning of A.Offered / Accepted / Status columns (landscape)? |
| Q-12 | **Sync/report:** is the red sync icon tappable to retry? Is the PDF generated server-side? Who are email recipients and does "Send email" use a server endpoint? |
| Q-13 | **Pending-upload badge** (floating icon with count): what opens when tapped? "Optimize Image" settings (max size/quality)? |

### Scope / product decisions

| # | Question |
|---|---|
| Q-14 | **Tabs:** are the 8 tabs seen always present, or driven per *Inspection Type* (inline, pre-final…)? Are there other inspection types with different forms? |
| Q-15 | **Roles/other screens:** any user other than the QC (supervisor, admin)? Any screens not in these documents? |
| Q-16 | **Web equivalents:** acceptable to replace Touch/Face ID with WebAuthn, push notifications with Web Push (or omit), and "System Diagnostics" with browser/network/device info only? |
| Q-17 | **Languages:** which languages besides English (Spanish seen)? Is text in master data already localised by the server? |
| Q-18 | **Landscape toggle:** OK to retire in favour of one responsive layout? |
| Q-19 | **Branding:** keep WFX teal/blue theme and logo as the base? Light-only or also dark mode? |
| Q-20 | **Report a bug** destination (email, ticketing URL, in-app form)? **Footer "World Fashion Exchange…" tap** action? |
| Q-21 | **Data oddities** to fix or preserve: `6\"` escape in POM names, "No Confirmed", "FInishing", RA action text shown as "." when empty. |
| Q-22 | **Angular version/tooling:** OK to scaffold with the latest stable Angular compatible with Node 22.23 (CLI installed via `npx`)? Package manager preference (npm assumed)? |

---

### Approval requested
1. Confirm the architecture/UX direction (§7–10).
2. Answer at least **Q-1 → Q-6** (or tell me to proceed on the stated [I] assumptions and mock rules, which I will keep isolated in `domain/rules/` so they are trivial to correct).
3. Confirm the build order in §11.

I will not start implementation until you approve.
