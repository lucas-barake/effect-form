---
"@lucas-barake/effect-form-react": minor
---

**BREAKING CHANGE**: Restructured `FieldComponentProps` to support custom props in field components.

Field components now receive `{ field, props }` instead of flat props:

```tsx
// Before
const TextInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> =
  ({ value, onChange, onBlur, error }) => (
    <input value={value} onChange={e => onChange(e.target.value)} />
  )

// After
const TextInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> =
  ({ field }) => (
    <input value={field.value} onChange={e => field.onChange(e.target.value)} />
  )
```

Custom props can now be passed at render time:

```tsx
const TextInput: React.FC<
  FormReact.FieldComponentProps<typeof Schema.String, { placeholder?: string }>
> = ({ field, props }) => (
  <input value={field.value} placeholder={props.placeholder} ... />
)

// Usage
<LoginForm.email placeholder="Enter email" />
```

Added `FormReact.forField()` helper for ergonomic component definition with type inference.
