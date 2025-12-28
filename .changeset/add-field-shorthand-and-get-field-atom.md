---
"@lucas-barake/effect-form": minor
"@lucas-barake/effect-form-react": minor
---

Add inline `addField` shorthand and per-field subscriptions via `getFieldAtom`

**New Features:**

1. **Inline `addField` syntax** - Define fields without `Field.makeField` for one-off fields:
   ```ts
   FormBuilder.empty
     .addField("email", Schema.String)
     .addField("age", Schema.Number)
   ```
   Use `Field.makeField` when you need to share fields across multiple forms.

2. **Per-field subscriptions** - Subscribe to individual field values without re-rendering when other fields change:
   ```ts
   const emailAtom = form.getFieldAtom(form.fields.email)
   const email = useAtomValue(emailAtom) // Only re-renders when email changes
   ```
