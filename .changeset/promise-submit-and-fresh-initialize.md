---
"@lucas-barake/effect-form": minor
"@lucas-barake/effect-form-react": minor
"@lucas-barake/effect-form-solid": minor
---

`onSubmit` may now return a Promise. It is awaited and its resolved value becomes the submit result. A rejected Promise fails the submit as a defect and does not record `lastSubmittedValues`. Previously the Promise itself was treated as a successful result.

`Initialize` now starts a fresh form session through the new core `initializeAtom`. It clears errors, per-field validation results, and the submit and validate results, the same way `reset` does. This fixes a stale schema error that could appear after a form remounted in a long-lived registry.
