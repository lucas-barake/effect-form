---
"@lucas-barake/effect-form": minor
"@lucas-barake/effect-form-react": minor
---

Replace `setValue`, `getFieldValue`, and `getFieldIsDirty` with a single `getFieldAtoms(fieldRef)` accessor that returns a bundle of safe per-field atoms: `value`, `error`, `isDirty`, `isTouched`, `isValidating`, `setValue`, and `setTouched`.
