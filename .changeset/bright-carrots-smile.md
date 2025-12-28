---
"@lucas-barake/effect-form": minor
"@lucas-barake/effect-form-react": minor
---

feat: expose `values` atom on built form

- Added `form.values` atom returning `Option<EncodedValues>` - `None` before initialization, `Some(values)` after
- Allows parent components to safely subscribe to form values without throwing

feat: auto-provide AtomRegistry in refineEffect

- `AtomRegistry` is now excluded from the `R` type in `refineEffect` since it's auto-provided by the runtime
- Users can access `yield* Registry.AtomRegistry` in async refinements without providing it manually
