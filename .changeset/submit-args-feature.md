---
"@lucas-barake/effect-form": minor
"@lucas-barake/effect-form-react": minor
---

feat: add custom submit arguments support

- Add `SubmitArgs` type parameter to `onSubmit` (defaults to `void` for backwards compatibility)
- New signature: `onSubmit: (args, { decoded, encoded, get }) => ...`
- Auto-submit is restricted at the type level when `SubmitArgs` is not `void`
