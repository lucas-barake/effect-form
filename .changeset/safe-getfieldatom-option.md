---
"@lucas-barake/effect-form": minor
"@lucas-barake/effect-form-react": minor
---

Make `getFieldAtom` return `Option.Option<S>` instead of throwing when accessed before initialization

**Breaking Change:**

`getFieldAtom` now returns `Atom<Option.Option<S>>` instead of `Atom<S>`. This prevents crashes when subscribing before `<form.Initialize>` mounts.

```tsx
// Before (would crash if used outside Initialize)
const email = useAtomValue(form.getFieldAtom(form.fields.email))

// After (safe to use anywhere)
const emailOption = useAtomValue(form.getFieldAtom(form.fields.email))
return Option.match(emailOption, {
  onNone: () => <span>Loading...</span>,
  onSome: (email) => <span>{email}</span>,
})
```

Internal field components are unaffected - they still use the efficient direct access since they're guaranteed to run inside `<Initialize>`.
