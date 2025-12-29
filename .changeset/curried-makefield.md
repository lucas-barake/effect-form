---
"@lucas-barake/effect-form-react": major
---

**BREAKING:** Changed `makeField` to use a curried API for better type inference.

Previously, users had to explicitly type `FieldComponentProps` including the schema type:

```tsx
const NameInput = FormReact.makeField({
  key: "name",
  schema: Schema.String,
  component: ({ field, props }: FormReact.FieldComponentProps<typeof Schema.String, { disabled: boolean }>) => ...
})
```

Now, `makeField` is curried - the schema type is captured first, so you only need to specify extra props:

```tsx
// No extra props
const NameInput = FormReact.makeField({
  key: "name",
  schema: Schema.String,
})(({ field }) => ...)

// With extra props - only specify the props type
const NameInput = FormReact.makeField({
  key: "name",
  schema: Schema.String,
})<{ disabled: boolean }>(({ field, props }) => ...)
```

Migration: Move `component` from inside the config object to a second function call.

Additionally, `makeField` now automatically sets the component's `displayName` based on the key (e.g., `"name"` → `"NameField"`), improving React DevTools debugging experience.
