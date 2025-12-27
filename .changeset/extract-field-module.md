---
"@lucas-barake/effect-form": minor
"@lucas-barake/effect-form-react": minor
---

Extract Field module from Form

- Add dedicated `Field` module with field definitions, constructors, type helpers, and guards
- `Field.makeField`, `Field.makeArrayField` for creating field definitions
- `Field.isFieldDef`, `Field.isArrayFieldDef` type guards
- `Field.getDefaultEncodedValues`, `Field.createTouchedRecord` helpers
- Re-export `Field` from `@lucas-barake/effect-form-react` for convenience
