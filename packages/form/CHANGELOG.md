# @lucas-barake/effect-form

## 0.10.0

### Minor Changes

- [#25](https://github.com/lucas-barake/effect-form/pull/25) [`40d8018`](https://github.com/lucas-barake/effect-form/commit/40d80183313333c7615993ff5d84bf995c218b89) Thanks [@lucas-barake](https://github.com/lucas-barake)! - Add inline `addField` shorthand and per-field subscriptions via `getFieldAtom`

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

## 0.9.1

### Patch Changes

- [#23](https://github.com/lucas-barake/effect-form/pull/23) [`de199a0`](https://github.com/lucas-barake/effect-form/commit/de199a009f6005308362bcecc2da778384bfba63) Thanks [@lucas-barake](https://github.com/lucas-barake)! - Fix public atoms crashing when subscribed before Initialize mounts

  Previously, atoms like `isDirty`, `submitCount`, `hasChangedSinceSubmit` used `Option.getOrThrow` which would crash if a consumer subscribed before `<form.Initialize>` mounted. Now they return safe defaults (`false`, `0`, empty sets) when the form state is not yet initialized.

## 0.9.0

### Minor Changes

- [#21](https://github.com/lucas-barake/effect-form/pull/21) [`ab80237`](https://github.com/lucas-barake/effect-form/commit/ab80237b5c7a338bf3e300ef539421cbef2438ce) Thanks [@lucas-barake](https://github.com/lucas-barake)! - Expose Path module as public API

  The Path utilities (`schemaPathToFieldPath`, `isPathUnderRoot`, `isPathOrParentDirty`, `getNestedValue`, `setNestedValue`) are now exported as a public module via `@lucas-barake/effect-form/Path`.

  This fixes an issue where `form-react` was importing from an unexported internal path, causing bundler errors in consuming applications.

## 0.8.0

### Minor Changes

- [#19](https://github.com/lucas-barake/effect-form/pull/19) [`9affd2b`](https://github.com/lucas-barake/effect-form/commit/9affd2bf87c1f0c910ca419d82c16e873cbf56ab) Thanks [@lucas-barake](https://github.com/lucas-barake)! - feat: add custom submit arguments support
  - Add `SubmitArgs` type parameter to `onSubmit` (defaults to `void` for backwards compatibility)
  - New signature: `onSubmit: (args, { decoded, encoded, get }) => ...`
  - Auto-submit is restricted at the type level when `SubmitArgs` is not `void`

## 0.7.0

### Minor Changes

- [#17](https://github.com/lucas-barake/effect-form/pull/17) [`d0ec0d8`](https://github.com/lucas-barake/effect-form/commit/d0ec0d825e1a208d23e929f9e106031f452719a2) Thanks [@lucas-barake](https://github.com/lucas-barake)! - feat: expose `values` atom on built form
  - Added `form.values` atom returning `Option<EncodedValues>` - `None` before initialization, `Some(values)` after
  - Allows parent components to safely subscribe to form values without throwing

  feat: auto-provide AtomRegistry in refineEffect
  - `AtomRegistry` is now excluded from the `R` type in `refineEffect` since it's auto-provided by the runtime
  - Users can access `yield* Registry.AtomRegistry` in async refinements without providing it manually

## 0.6.0

### Minor Changes

- [#12](https://github.com/lucas-barake/effect-form/pull/12) [`09d48cc`](https://github.com/lucas-barake/effect-form/commit/09d48cc36728324f0a63baebb12d00a5c7f1a579) Thanks [@lucas-barake](https://github.com/lucas-barake)! - Store both encoded and decoded values in lastSubmittedValues
  - Changed `lastSubmittedValues` to store `{ encoded, decoded }` instead of just encoded values
  - Only set `lastSubmittedValues` on successful validation (not on validation failure)
  - Added performance optimizations to dirty field tracking with early returns for reference equality
  - Simplified auto-submit initialization by removing unnecessary microtask

## 0.5.0

### Minor Changes

- [#10](https://github.com/lucas-barake/effect-form/pull/10) [`aa80cc6`](https://github.com/lucas-barake/effect-form/commit/aa80cc66505d230b3ca0cf51419a89afd2dd4255) Thanks [@lucas-barake](https://github.com/lucas-barake)! - Move onSubmit to build options and expose fine-grained atoms

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

## 0.4.0

### Minor Changes

- [#6](https://github.com/lucas-barake/effect-form/pull/6) [`046ec9f`](https://github.com/lucas-barake/effect-form/commit/046ec9f410161927bc38f767db63c4e1304f7a64) Thanks [@lucas-barake](https://github.com/lucas-barake)! - feat: support non-Effect return values in submit callback

  The `submit` helper now accepts callbacks that return plain values (not just `Effect`). This is checked at runtime using `Effect.isEffect` and wrapped with `Effect.succeed` if needed.

  ```tsx
  // Now works - plain value
  const handleSubmit = MyForm.submit((values) => {
    console.log(values)
    return { success: true }
  })

  // Still works - Effect
  const handleSubmit = MyForm.submit((values) =>
    Effect.log(`Submitted: ${values.email}`),
  )
  ```

  BREAKING CHANGE: Renamed `Form` module to `FormBuilder` to avoid namespace conflicts with user components. Also renamed `Form.Field<S>` to `FormBuilder.FieldRef<S>`.

  Migration:
  - `import { Form } from "@lucas-barake/effect-form"` → `import { FormBuilder } from "@lucas-barake/effect-form"`
  - `Form.empty` → `FormBuilder.empty`
  - `Form.Field<S>` → `FormBuilder.FieldRef<S>`

## 0.3.0

### Minor Changes

- [#4](https://github.com/lucas-barake/effect-form/pull/4) [`12dc7cc`](https://github.com/lucas-barake/effect-form/commit/12dc7cc1050d09e8c5c104f3a86d0d1afcc1ae8e) Thanks [@lucas-barake](https://github.com/lucas-barake)! - Add ability to track changes since last submit
  - `hasChangedSinceSubmit`: boolean indicating values differ from last submit
  - `lastSubmittedValues`: `Option<T>` containing the last submitted values
  - `revertToLastSubmit()`: restores form to last submitted state

  These APIs are available via both `useForm()` hook and `Subscribe` component.

## 0.2.0

### Minor Changes

- [#2](https://github.com/lucas-barake/effect-form/pull/2) [`58c07b5`](https://github.com/lucas-barake/effect-form/commit/58c07b594473c3ca497b29795146ead7521f9cf0) Thanks [@lucas-barake](https://github.com/lucas-barake)! - Extract Field module from Form
  - Add dedicated `Field` module with field definitions, constructors, type helpers, and guards
  - `Field.makeField`, `Field.makeArrayField` for creating field definitions
  - `Field.isFieldDef`, `Field.isArrayFieldDef` type guards
  - `Field.getDefaultEncodedValues`, `Field.createTouchedRecord` helpers
  - Re-export `Field` from `@lucas-barake/effect-form-react` for convenience

## 0.1.0

### Minor Changes

- [`3818818`](https://github.com/lucas-barake/effect-form/commit/381881893ac58a500f69c2379ae556f55c07356c) Thanks [@lucas-barake](https://github.com/lucas-barake)! - Initial release of effect-form

  Features:
  - Type-safe form builder powered by Effect Schema
  - Declarative field definitions with `makeField` and `makeArrayField`
  - Array fields with append, remove, swap, and move operations
  - Cross-field validation with `refine` and async validation with `refineEffect`
  - Multiple validation modes: onSubmit, onBlur, onChange (with optional debounce)
  - Dirty tracking at form and field level
  - React bindings with `FormReact.build`
  - Support for Effect services in validation via runtime
