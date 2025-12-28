---
"@lucas-barake/effect-form": patch
---

Fix public atoms crashing when subscribed before Initialize mounts

Previously, atoms like `isDirty`, `submitCount`, `hasChangedSinceSubmit` used `Option.getOrThrow` which would crash if a consumer subscribed before `<form.Initialize>` mounted. Now they return safe defaults (`false`, `0`, empty sets) when the form state is not yet initialized.
