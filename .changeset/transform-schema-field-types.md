---
"@lucas-barake/effect-form": minor
"@lucas-barake/effect-form-react": minor
---

Add `FieldValue<T>` and `FieldComponent<T, P>` helper types for defining field components. Components can now use either value types (`FieldComponent<string>`) or Schema types (`FieldComponent<typeof Schema.NumberFromString>`). Remove unused `forField`, `makeField`, and `FieldBundle` APIs. Remove redundant JSDoc comments.
