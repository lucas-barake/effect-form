---
"@lucas-barake/effect-form": minor
"@lucas-barake/effect-form-react": minor
---

Add ability to track changes since last submit

- `hasChangedSinceSubmit`: boolean indicating values differ from last submit
- `lastSubmittedValues`: `Option<T>` containing the last submitted values
- `revertToLastSubmit()`: restores form to last submitted state

These APIs are available via both `useForm()` hook and `Subscribe` component.
