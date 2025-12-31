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

Add KeepAlive for persisting form state across unmounts

- Added `form.KeepAlive` component to preserve state when `Initialize` unmounts (for wizards, tabs, conditional fields)
- Added `form.mount` atom for hook-based mounting via `useAtomMount(form.mount)`
- Initialize now checks if KeepAlive is active before deciding whether to re-initialize
