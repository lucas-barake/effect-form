---
"@lucas-barake/effect-form": minor
"@lucas-barake/effect-form-react": minor
---

Initial release of effect-form

Features:
- Type-safe form builder powered by Effect Schema
- Declarative field definitions with `makeField` and `makeArrayField`
- Array fields with append, remove, swap, and move operations
- Cross-field validation with `refine` and async validation with `refineEffect`
- Multiple validation modes: onSubmit, onBlur, onChange (with optional debounce)
- Dirty tracking at form and field level
- React bindings with `FormReact.build`
- Support for Effect services in validation via runtime
