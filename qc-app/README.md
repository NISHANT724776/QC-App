# WFX Quality Controller – Angular

Modern, responsive rebuild of the WFX Quality Controller mobile app (.NET MAUI) as an Angular 22 application.
Business context, rules and open questions: see [`../docs`](../docs).

```bash
npm install
npm start      # dev server on http://localhost:4200 (mock data layer)
npm test       # unit tests
npm run build  # production build
```

## Architecture
```
src/app
├─ core/       singletons: auth (PIN/biometric), i18n, settings, storage (IndexedDB), sync (requests/forms/outbox), http interceptors, toast/network
├─ domain/     typed models + PURE rule functions (sample size, variance, tolerance, defect totals, submit readiness) – unit tested
├─ data/       repository contracts (abstract classes) + mock implementations and fixtures; swap in provide-data.ts when the API exists
├─ shared/     reusable UI: icon, top-bar, select-field, chip-choice, counter-stepper, photo picker/strip, calendar & signature dialogs …
└─ features/   access (registration, pin) · requests (list, card, report) · inspection (shell, store, sections) · settings (profile)
```

Key ideas
- **Config-driven inspection:** sections, evaluation groups, checkpoints, defect lists and flags come from the form configuration; the UI renders them.
- **Offline-first:** requests, form configs, drafts and the outbox live in IndexedDB; *Sync* pushes then pulls.
- **Rules are isolated** in `domain/rules` so business corrections are one-file changes. Assumed rules are labelled `ASSUMPTION` in code.
- **Performance:** lazy routes, OnPush + signals, debounced search, lazy-loaded signature pad, client-side image compression.
