# Test report — app vs. provided documents

**Sources tested against:** `WFXQC-ScreenShot.docx` (59 screenshots) and `WFXQCPlus App(Xaml_Code).docx` (screens, fields, flags).
**Method:** (1) 39 automated unit tests, including fixtures checked line-by-line against the screenshots; (2) browser walk-through of every screen and state in the running app (desktop and 375 px phone), driving the real UI.
**Result:** all documented behaviour passes, and **the app now follows the documents' screens, labels, controls and data — there are no deliberate design differences left** (§3). Rules that the documents do not state cannot be tested and stay as assumptions (see `Questions_for_Seniors.md`).

## 1. Automated tests (`npm test`) — 40 passed
| Suite | What it proves |
|---|---|
| Rules (14) | fraction parsing, tolerance (screenshot values 10 → out, 20 1/2 → ok), summary 12/1 → sample 3, variance −2, cartons N inputs, defect totals/limits/Eq. Total |
| Mock PDF (1) | generated report is a structurally valid PDF |
| Screenshot conformance (24) | request data, tab order, summary rows, RA activities, POM list/tolerances, defect list, quality/packing checklists, choices, final-result flags |

## 2. Browser conformance (screenshot / XAML → app)
| # | Document reference | Check | Result |
|---|---|---|---|
| 1 | Screenshot 1, XAML Registration | Fields: user, password (masked), company id, URL; lower-casing; empty and invalid-URL errors | ✅ pass |
| 2 | Screenshots 2, 39 / XAML EnterPin | PIN: digits only, max 4, masked, confirm on create, mismatch/short errors | ✅ pass |
| 3 | XAML EnterPin login mode | Relaunch goes to PIN; no confirm field; wrong PIN error + cleared; correct PIN auto-submits on 4th digit | ✅ pass |
| 4 | Screenshots 3, 40, 44 | Active/Completed tabs, date headings (Nov 02/14 2026), request # format, +N badge, cancel ✕ only when flagged, version, Last Sync format | ✅ pass |
| 5 | Screenshots 4, 41 | Empty state "No Data Found!" | ✅ pass after fix (text was "No data found!") |
| 6 | Screenshots 5, 42 | Calendar: yellow dots on dates with requests, today ring, red Cancel / teal OK; pick date → Day filter | ✅ pass |
| 7 | Screenshots 25–27, 37 | Day / Week (7 days ending on date) / Month, prev/next, search filter, empty result | ✅ pass |
| 8 | Screenshots 7, 26, 44 | Card expands: order table, comment, attachment links; cancel asks confirmation | ✅ pass |
| 9 | Screenshots 22, 23, 58, 59 | Completed row: green dot/bar, PDF icon, red sync → green after Sync | ✅ pass |
| 10 | Screenshots 6, 43 / XAML Profile | Toggles, language (instant), URL/PIN update, Update, Unregister (confirm → Registration) | ✅ pass |
| 11 | XAML Profile diagnostics | All 13 diagnostic fields shown | ✅ pass |
| 12 | Screenshots 8, 28, 45 | Summary: totals, Sample Size 3, Variance −2, digits-only, cartons offered ≤ 9 / inspected ≤ 3 digits, c1…cN inputs, values kept when N shrinks | ✅ pass |
| 13 | Save / Discard on every tab | Save → "Saved" ✓ chip; Discard → confirm → reverts and chip resets | ✅ pass |
| 14 | Screenshots 9, 29, 46 | RA Sheet: 8 activities, Sewing risk/action, expand text, comments, attachments | ✅ pass |
| 15 | Screenshots 10, 30, 47 | Measurement: size tabs, POM rows/tolerances, red flag + icon, boundary inclusive, invalid hint, add/delete sample, colour per sample, critical badge, data kept per size | ✅ pass |
| 16 | Screenshots 12, 33, 49 | Defects: groups, − / + counters (no negatives, junk → 0), critical marker, Actual/Ac. Limit totals, warning, Other defects add | ✅ pass |
| 17 | Screenshots 13–18, 50–54 | Defect photo dialog (title, Upload / Save / Cancel), gallery/camera sheet, thumbnail + comment, compression to 1600 px, icon highlight + count | ✅ pass |
| 18 | Screenshots 11, 32, 48 | Measurement Results: comments box, Result preset "Approved" | ✅ pass |
| 19 | Screenshots 19, 34, 55 | Quality Checklist: 11 items incl. "Extra button/Botón extra", Confirmed / No Confirmed, tap again clears, photo tile | ✅ pass |
| 20 | Screenshots 20, 35, 56 | Packing: Folding(3) / Trims(4) / Cartons(8), photo tile on Cartons, manual Result (Rejected with open checkpoints) | ✅ pass |
| 21 | Screenshots 21, 36, 57 / XAML FinalResult | Judgement date (read-only, today), Judgement popup, remarks, QC + FR signature pads (OK disabled until drawn), edit icon, Submit gated | ✅ pass |
| 22 | XAML FinalResult flags | Accepted / Second / Scrap grids with totals, mismatch banner + Update | ✅ pass |
| 23 | Screenshots 22–23, 58–59 | Submit → request moves out of Active; multi-order request stays Active until all orders done | ✅ pass |
| 24 | XAML upload badge | Pending-photo badge shows 1; tap → Sync → badge clears, icon green | ✅ pass |
| 25 | XAML "no internet" snackbars | Offline: notice shown, Sync refuses with message, local data intact; back online works | ✅ pass |
| 26 | XAML ReportView | Report opens, valid PDF built from submitted data (request, Major 3, Judgement), Send email → "Report sent as email" | ✅ pass |
| 27 | Submitted result | Locked banner, all inputs disabled, no Save/Discard/Submit | ✅ pass |
| 28 | Drafts | Unsaved-changes guard on leaving; unsaved work restored after reload | ✅ pass |
| 29 | Portrait screenshots 38–59 | 375 px phone layout: list, defects as cards, measurements with sticky POM column | ✅ pass (layout checked visually) |

## 3. Conformance changes made after the first test (all differences removed)
The first version used my own redesign in places. Each item below was changed to match the documents:

| Document shows | App now does |
|---|---|
| Landscape ⋮ menu "View Active / View Completed Requests", Day/Week/Month header, no tabs | **Landscape Layout** is a real switch (Profile). Landscape set: `< range >`, Day/Week/Month (Week default), search, calendar, ⋮ menu; Portrait set: Active/Completed tabs + search + calendar |
| "Info – The app will restart to apply the new settings. Cancel / Confirm" | Same dialog; Confirm saves the setting and restarts (reloads) the app. Language change uses it too |
| Portrait summary: one "Standard" picker + list; Landscape: Original/Revise Standard + size matrix with Variance and TOTAL row | Both layouts built that way (Sample Size line shown in portrait only, as in the XAML) |
| Portrait card table Order No./Style Name/Order Qty./Offer Qty.; landscape Order No./Color/Ordered/Offered/A.Offered/Accepted/Delivery Date/Status; no chevron | Same columns per layout, no chevron |
| Upload badge always visible (shows 0) | Always visible |
| Calendar: Cancel / OK only | No extra "Clear date" button (portrait shows a small removable date chip so the filter can be cleared) |
| Evaluation screens use dropdowns defaulting to "Select", teal header (Checkpoint/Result/Comments) even when empty, teal "Result" bar with dropdown | Chips replaced by dropdowns; headers and Result bar as in the screenshots |
| Tab strip across the top; no side rail, no status chips, no live totals bar, no checklist card | Rail, chips, live bar, readiness card, "ident" line and locked banner removed; plain tab strip |
| Submit Result as a full-width button under Discard/Save on Final Result | Same; when required items are missing it shows a message naming them |
| Measurement: portrait "POM / +VE -VE / Actual" plain header; landscape "Point Of Measurement / +ve -ve / Actual n" teal header | Both |
| Landscape final result: size matrices + teal "Decision" bar; portrait stacked fields | Both |
| RA Sheet: raw server text ("." for empty), no label above the link icon, truncated text, same columns on phone | Same |
| Defects: table (Defect Title/Remarks/Major/Minor/Action) with truncated names on phone; plain totals table | Same (no cards, no extra warning text, not sticky) |
| "Enable Touch/Face ID" always visible | Always visible; message when the device cannot do biometrics |
| Data as shown: "FInishing", `6\"` | Seed data keeps them exactly |
| Empty state "No Data Found!" | Fixed earlier |

Kept (not visible in the documents, invisible safety features): unsaved-changes prompt on leaving, automatic recovery of unsaved work after a reload, read-only view of submitted results, client-side photo compression, offline notice.

## 4. Not covered by this test
- Real camera capture, real biometric prompt, real notification permission grant (need a physical device/browser prompt).
- Inline PDF rendering (the preview browser has no PDF plugin; file validity was verified, plus an "Open PDF" button).
- Anything that depends on the real server or business formulas the documents do not contain (Questions Q1–Q6, E1–E14).
- Test method note: the preview pane is hidden, so screens render late; checks waited for rendering before reading results.
