---
"@lucas-barake/effect-form": minor
"@lucas-barake/effect-form-react": minor
---

feat: support non-Effect return values in submit callback

The `submit` helper now accepts callbacks that return plain values (not just `Effect`). This is checked at runtime using `Effect.isEffect` and wrapped with `Effect.succeed` if needed.

```tsx
// Now works - plain value
const handleSubmit = MyForm.submit((values) => {
  console.log(values)
  return { success: true }
})

// Still works - Effect
const handleSubmit = MyForm.submit((values) =>
  Effect.log(`Submitted: ${values.email}`)
)
```

BREAKING CHANGE: Renamed `Form` module to `FormBuilder` to avoid namespace conflicts with user components. Also renamed `Form.Field<S>` to `FormBuilder.FieldRef<S>`.

Migration:
- `import { Form } from "@lucas-barake/effect-form"` → `import { FormBuilder } from "@lucas-barake/effect-form"`
- `Form.empty` → `FormBuilder.empty`
- `Form.Field<S>` → `FormBuilder.FieldRef<S>`
