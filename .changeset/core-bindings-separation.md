---
"@lucas-barake/effect-form": minor
"@lucas-barake/effect-form-react": minor
---

Move validation, error display, and auto-submit logic into the core package so bindings are leaner. Refactor the mode configuration shape to `{ validation, debounce, autoSubmit }`. Support `Schema.filterEffect` in field definitions and array item schemas. Replace `setValue`, `getFieldValue`, and `getFieldIsDirty` with a single `getFieldAtoms(fieldRef)` accessor that returns a bundle of safe per-field atoms: `value`, `error`, `isDirty`, `isTouched`, `isValidating`, `setValue`, and `setTouched`.
