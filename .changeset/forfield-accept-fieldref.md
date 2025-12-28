---
"@lucas-barake/effect-form-react": patch
---

`forField` now accepts both `FieldRef` (from `form.fields.x`) and `FieldDef` (from `Field.makeField`)

```tsx
// Now works with FieldRef - no need for Field.makeField
const TextInput = FormReact.forField(form.fields.email)(({ field }) => (
  <input value={field.value} onChange={(e) => field.onChange(e.target.value)} />
))
```
