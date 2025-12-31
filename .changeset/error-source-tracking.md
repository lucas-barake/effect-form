---
"@lucas-barake/effect-form": minor
"@lucas-barake/effect-form-react": minor
---

Distinguish per-field errors from cross-field refinement errors

- Per-field schema errors (minLength, pattern, etc.) now clear immediately when the user types a valid value
- Cross-field refinement errors (password !== confirm) persist until re-submit
- Added `rootErrorAtom` for displaying root-level form errors (exposed as `form.rootError` in React)
- Renamed `crossFieldErrorsAtom` to `errorsAtom` with new `ErrorEntry` type containing `source: 'field' | 'refinement'`
- Renamed `FieldAtoms.crossFieldErrorAtom` to `errorAtom`
