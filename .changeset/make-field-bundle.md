---
"@lucas-barake/effect-form-react": minor
---

Add `FormReact.makeField` for bundled field + component definitions

**New Feature:**

`FormReact.makeField` bundles a field definition with its component in one place, reducing boilerplate for form-heavy applications:

```tsx
const NameInput = FormReact.makeField({
  key: "name",
  schema: Schema.String.pipe(Schema.nonEmptyString()),
  component: ({ field }) => (
    <input value={field.value} onChange={(e) => field.onChange(e.target.value)} />
  ),
})

// Use .field for form builder
const form = FormBuilder.empty.addField(NameInput.field)

// Use the bundle directly in build()
FormReact.build(form, {
  runtime,
  fields: { name: NameInput },
  onSubmit: ...,
})
```

**Breaking Change:**

Removed the `FieldRef` overload from `forField` since it was architecturally impossible to use (`form.fields.x` doesn't exist until after `build()` returns, but components must be passed into `build()`). Use `forField` with `FieldDef` (from `Field.makeField`) instead.
