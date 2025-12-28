---
"@lucas-barake/effect-form": minor
"@lucas-barake/effect-form-react": minor
---

Expose Path module as public API

The Path utilities (`schemaPathToFieldPath`, `isPathUnderRoot`, `isPathOrParentDirty`, `getNestedValue`, `setNestedValue`) are now exported as a public module via `@lucas-barake/effect-form/Path`.

This fixes an issue where `form-react` was importing from an unexported internal path, causing bundler errors in consuming applications.
