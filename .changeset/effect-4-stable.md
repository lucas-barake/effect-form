---
"@lucas-barake/effect-form": minor
"@lucas-barake/effect-form-react": minor
"@lucas-barake/effect-form-solid": minor
---

Require Effect 4.0.0 stable

- Raise the `effect` peer range to `^4.0.0`, and the `@effect/atom-react` and `@effect/atom-solid` peer ranges to `^4.0.0`. Effect 4.0.0 moved `effect/unstable/reactivity/*` to `effect/reactivity/*`, so beta and rc releases of Effect can no longer satisfy these packages.
- Import `Atom`, `AtomRegistry`, and `AsyncResult` from `effect/reactivity/*` instead of `effect/unstable/reactivity/*`.
- Raise the Solid adapter's `solid-js` peer floor to `1.9.14`, matching `@effect/atom-solid` 4.0.0.
