---
"@lucas-barake/effect-form-react": minor
---

Make `runtime` optional in `FormReact.make()` for forms without service requirements

When `R = never` (no services needed), runtime can be omitted and defaults to `Atom.runtime(Layer.empty)`.
Forms with service requirements (via `refineEffect` or `Schema.filterEffect`) still require an explicit runtime.
