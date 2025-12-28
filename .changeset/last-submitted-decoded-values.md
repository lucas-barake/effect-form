---
"@effect-form/form": minor
"@effect-form/form-react": minor
---

Store both encoded and decoded values in lastSubmittedValues

- Changed `lastSubmittedValues` to store `{ encoded, decoded }` instead of just encoded values
- Only set `lastSubmittedValues` on successful validation (not on validation failure)
- Added performance optimizations to dirty field tracking with early returns for reference equality
- Simplified auto-submit initialization by removing unnecessary microtask
