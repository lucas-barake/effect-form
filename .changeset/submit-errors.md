---
"@lucas-barake/effect-form": minor
"@lucas-barake/effect-form-react": minor
"@lucas-barake/effect-form-solid": minor
---

Add `submitErrors`, which maps a typed failure of `onSubmit` to field and form-level errors. Paths are typed by the new `Field.FieldPath`, so misspelled or nested paths do not compile. A field shows its submit error only while it holds the rejected value, and submit errors survive `validate` until the next submit, `reset` or re-initialization. `revertToLastSubmit` and `setValues` clear the form-level one. Forms also expose a read-only `fieldErrors` atom (`fieldErrorsAtom` in core) listing every displayed field error, array item paths included.
