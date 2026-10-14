---
"@lucas-barake/effect-form": minor
"@lucas-barake/effect-form-react": minor
"@lucas-barake/effect-form-solid": minor
---

`onSubmit` may now return a Promise. It is awaited and its resolved value becomes the submit result. A rejected Promise fails the submit as a defect and does not record `lastSubmittedValues`. Previously the Promise itself was treated as a successful result.

`Initialize` now initializes through the new core `initializeAtom`, which writes the initial state and clears errors and per-field validation results. This fixes a stale schema error that could appear after a form remounted in a long-lived registry. Submit and validate results are left as they are.
