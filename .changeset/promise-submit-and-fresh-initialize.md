---
"@lucas-barake/effect-form": minor
"@lucas-barake/effect-form-react": minor
"@lucas-barake/effect-form-solid": minor
---

`onSubmit` may now return a Promise. It is awaited and its resolved value becomes the submit result. A rejected Promise fails the submit as a defect and does not record `lastSubmittedValues`. Previously the Promise itself was treated as a successful result. When `onSubmit` returns a plain value or a Promise, the submit error type is now `SchemaError` instead of `unknown`, since a throw or rejection is a defect.

`Initialize` now initializes through the new core `initializeAtom`, which writes the initial state and clears errors and per-field validation results. This fixes a stale schema error that could appear after a form remounted in a long-lived registry. Submit and validate results are left as they are. Auto-submit no longer submits the default values when a form remounts in the same registry. A submit or `validate` still in flight when `Initialize` runs again no longer writes its errors, counts, or last submitted values into the newly initialized form.
