---
"@lucas-barake/effect-form": minor
"@lucas-barake/effect-form-react": minor
---

Move onSubmit to build options and expose fine-grained atoms

**Breaking Changes:**
- `onSubmit` moved from `Initialize` props to `build()` options
- Removed `useForm` hook and `Subscribe` component in favor of direct atom access

**New API:**
- Atoms: `isDirty`, `hasChangedSinceSubmit`, `lastSubmittedValues`, `submitCount`, `submit`
- Operations: `reset`, `revertToLastSubmit`, `setValue`, `setValues`

**Improvements:**
- Fixed auto-submit race condition by freezing onSubmit at build time
- Added `isPathUnderRoot` utility for consistent path-prefix matching
- Aligned error clearing behavior between UI onChange and programmatic setValue
