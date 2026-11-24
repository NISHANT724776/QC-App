# Questions for Seniors — WFX Quality Controller (Angular rebuild)

**Why we are asking:** The app is built and working with test (mock) data. The documents we received contain only screenshots and screen layouts, not the business rules or the server details. Where a rule was missing, we made a **safe assumption** (shown below). Please confirm or correct each one. Short answers are fine (a number, a table, "yes/no", or "ask X").

> Tip: if a question is easier to answer by sending a file, please send the file instead (marked 📎).

---

## Q1 — Can you share the original app's code and server details? 📎
**Simple question:** Do you have the *ViewModel / code-behind* files of the old mobile app, the *API (Swagger/Postman) document*, and the *language (.resx) files*?
**Why it matters:** These contain every formula and message. With them, nothing has to be guessed.
**Answer:** ☐ Yes, attached  ☐ Partly  ☐ No — contact: __________

## Q2 — Is this a replacement for the mobile app or an extra web version?
**Simple question:** Will QCs use this on **phones/tablets in the factory** (camera, works without internet) or mostly on **office computers**?
**Why it matters:** Decides how much offline support, camera and installable-app (PWA) work we invest in.
**What we built meanwhile:** Works on phone, tablet and desktop; keeps working with saved data when offline; Sync sends work later.
**Answer:** ☐ Replace mobile app  ☐ Web companion  ☐ Both   Mainly used on: ☐ phone ☐ tablet ☐ desktop

## Q3 — Is the server (API) ready for a website to use?
**Simple question:** Do these server functions already exist: login/register, get requests, get form data, save/submit result, upload photos, get PDF report, send email? How does login work (token? session?) and does the server allow a website to call it (CORS)?
**Why it matters:** Today the app uses a built-in fake server. We need the real addresses and data formats to connect it.
**Answer:** ☐ Ready — document attached  ☐ Not ready — expected date: ________  Login type: ________

## Q4 — Must inspections work with NO internet?
**Simple question:** If a QC is inside a factory with no signal, must they still be able to fill the full inspection and submit later? Which actions **need** internet (only Sync? also Save? Photo upload?)
**What we built meanwhile:** Everything works offline except Sync, report PDF and email. Results are saved on the device and sent when Sync is pressed (red icon → green icon, same as the old app).
**Answer:** ☐ Offline needed for all inspection work  ☐ Internet is always available  ☐ Other: __________

## Q5 — Sample size and "Standard" (AQL)
**Simple questions**
1. Which **Standards** should appear in the list (we show 1.0, 1.5, 2.5, 4.0, 6.5)?
2. How is **Sample Size** decided? In the old screenshot: *12 pieces offered, Standard 1.5 → Sample Size 3*. Please send the table (offered quantity → sample size).
3. Is **Variance = Inspected − Sample Size**? (Old screenshot: Inspected 1, Sample 3 → Variance **−2**.)
**What we assumed:** the common international table (ISO 2859 / ANSI Z1.4, General Level II) because it gives exactly 3 for 12 pieces, and Variance = Inspected − Sample Size.
**Answer:** Standards list: __________  Table attached: ☐  Variance formula OK: ☐ Yes ☐ No → correct formula: __________

## Q6 — Defect rules
**Simple questions**
1. Where does the **"Ac. Limit"** (acceptable limit) come from — comes from the server per inspection, or calculated from Standard + Sample Size? (Old screenshot showed 0 / 0 / 0.)
2. What is **"Eq. Total"**? Is it "X minor defects = 1 major defect"? If yes, what is X? (When does it show — only for some customers?)
3. When defects are **more than the limit**, or there is a **Critical** defect — should the system **only warn**, or **force the result to Rejected**?
4. Is **Micro** defect used? For which customers/inspection types?
**What we assumed:** limit comes from the server (shown as 0/0/0 for the test data); Eq. Total is **off** unless the server turns it on (3 minors = 1 major if on); only a **warning** is shown (red numbers); Micro off.
**Answer:** 1) ____________  2) X = ____ 3) ☐ Warn only ☐ Force Rejected 4) ____________

---

## Extra questions found while building (answer when possible — less urgent)

| # | Question in simple words | What we assumed for now |
|---|---|---|
| E1 | **Measurement:** Is a value exactly on the tolerance limit OK? Can QCs type decimals (e.g. 22.5) as well as fractions (22 1/2)? How many samples per size are allowed? | Limit value is OK (inclusive); both fractions and decimals accepted; no limit on samples |
| E2 | **Result lists:** What are all the choices for *checkpoint result* (we saw Confirmed / No Confirmed), *area/group result* (Approved / Rejected) and *final judgement*? Is any of them calculated automatically? | Choices come from the server; Result is picked **manually** (as in the old screenshots) |
| E3 | **Submit rules:** What must be complete before "Submit Result"? Can a submitted result be opened again to edit? | Needs Judgement + Date + both signatures; submitted results are locked (view only) |
| E4 | **Final result quantities** (Accepted / Second / Scrap): What turns these on? What triggers the "Accepted quantity does not match" message and what should the **Update** button do? | Shown only when the server turns them on; message when Accepted total ≠ Offered total; Update copies Offered quantities into Accepted |
| E5 | **Request list:** Which date is used for the date heading and calendar dots (inspection date, due date or delivery date)? What does the red **✕ Cancel** do? What do "A.Offered", "Accepted", "Status" columns mean? | Uses the request date; Cancel asks to confirm then removes the request |
| E6 | **Sync icon:** Can the QC tap the red icon to retry? Is the PDF made by the server? Who receives "Send email"? | Red icon retries Sync; PDF comes from the server; email goes to a server-defined recipient |
| E7 | **Photo upload badge** (small picture icon with number): what should happen when tapped? What image size/quality should "Optimize Image" use? | Tap = start Sync; images shrunk to max 1600 px, JPEG 80% |
| E8 | **Tabs:** Are the 8 tabs always the same, or do they change per inspection type (inline, pre-final …)? Are there other inspection types? | Tabs come from the server configuration, so any set works |
| E9 | **Users/roles:** Only the QC, or also supervisors/admins? | Only the QC |
| E10 | **Web replacements:** OK to use fingerprint/face of the device (WebAuthn) instead of the old Touch/Face ID, and browser notifications? Which **languages** besides English (Spanish seen)? | Yes to both; English + starter Spanish |
| E11 | **Landscape Layout switch:** this is kept exactly as in the old app (portrait and landscape screens, restart dialog). Should the app also choose the layout automatically from the device? | Manual switch only, as in the old app |
| E12 | **"Report a bug"** — where should it go (email / ticket tool)? **Footer text tap** — what did it do? | Bug report is copied to clipboard; footer is plain text |
| E13 | **Data typos** seen in the old screenshots: "FInishing", `6\"` instead of `6"`. These are kept as shown. Should they be corrected on the server? | Kept exactly as in the documents |
| E14 | **"+N" badge** on a request with many styles: should it show the number of *extra* styles or the total? | Shows the number from the server as-is |

---

### How we will use your answers
Each assumption lives in one small file (`src/app/domain/rules/…`) so a correction is a quick change and automatic tests re-check it.
