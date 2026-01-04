---
"@lucas-barake/effect-form": minor
---

Fix nested struct refinements being incorrectly classified as top-level refinements. Refinements on nested composite types (e.g., a field with `Schema.Struct(...).pipe(Schema.filterEffect(...))`) are now tagged with `source: "field"` instead of `source: "refinement"`, allowing field errors to clear when the user provides valid input.
