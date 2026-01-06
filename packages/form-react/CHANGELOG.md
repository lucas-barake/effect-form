# @lucas-barake/effect-form-react

## 0.14.0

### Minor Changes

- [#40](https://github.com/lucas-barake/effect-form/pull/40) [`a69a9ec`](https://github.com/lucas-barake/effect-form/commit/a69a9ec02b828aa4b40e8d8ad973169758e17ffd) Thanks [@lucas-barake](https://github.com/lucas-barake)! - Add `FieldValue<T>` and `FieldComponent<T, P>` helper types for defining field components. Components can now use either value types (`FieldComponent<string>`) or Schema types (`FieldComponent<typeof Schema.NumberFromString>`). Remove unused `forField`, `makeField`, and `FieldBundle` APIs. Remove redundant JSDoc comments.

### Patch Changes

- Updated dependencies [[`a69a9ec`](https://github.com/lucas-barake/effect-form/commit/a69a9ec02b828aa4b40e8d8ad973169758e17ffd)]:
  - @lucas-barake/effect-form@0.14.0

## 0.13.1

### Patch Changes

- Updated dependencies [[`7fb5c96`](https://github.com/lucas-barake/effect-form/commit/7fb5c96823916c95d04c8763bfe1baf7ed77c3a7)]:
  - @lucas-barake/effect-form@0.13.0

## 0.13.0

### Minor Changes

- [#36](https://github.com/lucas-barake/effect-form/pull/36) [`dbe8735`](https://github.com/lucas-barake/effect-form/commit/dbe87355012421584a79f09c3fc2eaf3f7b21a48) Thanks [@lucas-barake](https://github.com/lucas-barake)! - Distinguish per-field errors from cross-field refinement errors
  - Per-field schema errors (minLength, pattern, etc.) now clear immediately when the user types a valid value
  - Cross-field refinement errors (password !== confirm) persist until re-submit
  - Added `rootErrorAtom` for displaying root-level form errors (exposed as `form.rootError` in React)
  - Renamed `crossFieldErrorsAtom` to `errorsAtom` with new `ErrorEntry` type containing `source: 'field' | 'refinement'`
  - Renamed `FieldAtoms.crossFieldErrorAtom` to `errorAtom`

  Add KeepAlive for persisting form state across unmounts
  - Added `form.KeepAlive` component to preserve state when `Initialize` unmounts (for wizards, tabs, conditional fields)
  - Added `form.mount` atom for hook-based mounting via `useAtomMount(form.mount)`
  - Initialize now checks if KeepAlive is active before deciding whether to re-initialize

- [#35](https://github.com/lucas-barake/effect-form/pull/35) [`350fcc8`](https://github.com/lucas-barake/effect-form/commit/350fcc86d3e5720f8da25a33c8b2afe9281c0bb4) Thanks [@lucas-barake](https://github.com/lucas-barake)! - Make `runtime` optional in `FormReact.make()` for forms without service requirements

  When `R = never` (no services needed), runtime can be omitted and defaults to `Atom.runtime(Layer.empty)`.
  Forms with service requirements (via `refineEffect` or `Schema.filterEffect`) still require an explicit runtime.

- [#33](https://github.com/lucas-barake/effect-form/pull/33) [`c070551`](https://github.com/lucas-barake/effect-form/commit/c070551863b45a2ad5e01c40135de1bcba855794) Thanks [@lucas-barake](https://github.com/lucas-barake)! - Rename `FormReact.build` to `FormReact.make` to follow Effect naming conventions

### Patch Changes

- Updated dependencies [[`dbe8735`](https://github.com/lucas-barake/effect-form/commit/dbe87355012421584a79f09c3fc2eaf3f7b21a48)]:
  - @lucas-barake/effect-form@0.12.0

## 0.12.0

### Minor Changes

- [#31](https://github.com/lucas-barake/effect-form/pull/31) [`2a2b94e`](https://github.com/lucas-barake/effect-form/commit/2a2b94e7adee7b93c739f1e09419ff75bae6e127) Thanks [@lucas-barake](https://github.com/lucas-barake)! - **BREAKING:** Changed `makeField` to use a curried API for better type inference.

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

- [#28](https://github.com/lucas-barake/effect-form/pull/28) [`96339b8`](https://github.com/lucas-barake/effect-form/commit/96339b828ea886f0e61084d99b283b50a5e77843) Thanks [@lucas-barake](https://github.com/lucas-barake)! - Add `FormReact.makeField` for bundled field + component definitions

  **New Feature:**

  `FormReact.makeField` bundles a field definition with its component in one place, reducing boilerplate for form-heavy applications:

  ```tsx
  const NameInput = FormReact.makeField({
    key: "name",
    schema: Schema.String.pipe(Schema.nonEmptyString()),
    component: ({ field }) => (
      <input value={field.value} onChange={(e) => field.onChange(e.target.value)} />
    ),
  })

  // Use .field for form builder
  const form = FormBuilder.empty.addField(NameInput.field)

  // Use the bundle directly in build()
  FormReact.build(form, {
    runtime,
    fields: { name: NameInput },
    onSubmit: ...,
  })
  ```

  **Breaking Change:**

  Removed the `FieldRef` overload from `forField` since it was architecturally impossible to use (`form.fields.x` doesn't exist until after `build()` returns, but components must be passed into `build()`). Use `forField` with `FieldDef` (from `Field.makeField`) instead.

- [#30](https://github.com/lucas-barake/effect-form/pull/30) [`8b45cec`](https://github.com/lucas-barake/effect-form/commit/8b45cece1fbcac05e9139e4134ab73646f222081) Thanks [@lucas-barake](https://github.com/lucas-barake)! - Make `getFieldAtom` return `Option.Option<S>` instead of throwing when accessed before initialization

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

### Patch Changes

- Updated dependencies [[`8b45cec`](https://github.com/lucas-barake/effect-form/commit/8b45cece1fbcac05e9139e4134ab73646f222081)]:
  - @lucas-barake/effect-form@0.11.0

## 0.11.0

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

### Patch Changes

- [#27](https://github.com/lucas-barake/effect-form/pull/27) [`581dc29`](https://github.com/lucas-barake/effect-form/commit/581dc295965c93feb1eb5f7c1a9bbda9d20cb72f) Thanks [@lucas-barake](https://github.com/lucas-barake)! - `forField` now accepts both `FieldRef` (from `form.fields.x`) and `FieldDef` (from `Field.makeField`)

  ```tsx
  // Now works with FieldRef - no need for Field.makeField
  const TextInput = FormReact.forField(form.fields.email)(({ field }) => (
    <input
      value={field.value}
      onChange={(e) => field.onChange(e.target.value)}
    />
  ))
  ```

- Updated dependencies [[`40d8018`](https://github.com/lucas-barake/effect-form/commit/40d80183313333c7615993ff5d84bf995c218b89)]:
  - @lucas-barake/effect-form@0.10.0

## 0.10.0

### Minor Changes

- [#21](https://github.com/lucas-barake/effect-form/pull/21) [`ab80237`](https://github.com/lucas-barake/effect-form/commit/ab80237b5c7a338bf3e300ef539421cbef2438ce) Thanks [@lucas-barake](https://github.com/lucas-barake)! - Expose Path module as public API

  The Path utilities (`schemaPathToFieldPath`, `isPathUnderRoot`, `isPathOrParentDirty`, `getNestedValue`, `setNestedValue`) are now exported as a public module via `@lucas-barake/effect-form/Path`.

  This fixes an issue where `form-react` was importing from an unexported internal path, causing bundler errors in consuming applications.

### Patch Changes

- Updated dependencies [[`ab80237`](https://github.com/lucas-barake/effect-form/commit/ab80237b5c7a338bf3e300ef539421cbef2438ce)]:
  - @lucas-barake/effect-form@0.9.0

## 0.9.0

### Minor Changes

- [#19](https://github.com/lucas-barake/effect-form/pull/19) [`9affd2b`](https://github.com/lucas-barake/effect-form/commit/9affd2bf87c1f0c910ca419d82c16e873cbf56ab) Thanks [@lucas-barake](https://github.com/lucas-barake)! - feat: add custom submit arguments support
  - Add `SubmitArgs` type parameter to `onSubmit` (defaults to `void` for backwards compatibility)
  - New signature: `onSubmit: (args, { decoded, encoded, get }) => ...`
  - Auto-submit is restricted at the type level when `SubmitArgs` is not `void`

### Patch Changes

- Updated dependencies [[`9affd2b`](https://github.com/lucas-barake/effect-form/commit/9affd2bf87c1f0c910ca419d82c16e873cbf56ab)]:
  - @lucas-barake/effect-form@0.8.0

## 0.8.0

### Minor Changes

- [#17](https://github.com/lucas-barake/effect-form/pull/17) [`d0ec0d8`](https://github.com/lucas-barake/effect-form/commit/d0ec0d825e1a208d23e929f9e106031f452719a2) Thanks [@lucas-barake](https://github.com/lucas-barake)! - feat: expose `values` atom on built form
  - Added `form.values` atom returning `Option<EncodedValues>` - `None` before initialization, `Some(values)` after
  - Allows parent components to safely subscribe to form values without throwing

  feat: auto-provide AtomRegistry in refineEffect
  - `AtomRegistry` is now excluded from the `R` type in `refineEffect` since it's auto-provided by the runtime
  - Users can access `yield* Registry.AtomRegistry` in async refinements without providing it manually

### Patch Changes

- Updated dependencies [[`d0ec0d8`](https://github.com/lucas-barake/effect-form/commit/d0ec0d825e1a208d23e929f9e106031f452719a2)]:
  - @lucas-barake/effect-form@0.7.0

## 0.7.0

### Minor Changes

- [#12](https://github.com/lucas-barake/effect-form/pull/12) [`09d48cc`](https://github.com/lucas-barake/effect-form/commit/09d48cc36728324f0a63baebb12d00a5c7f1a579) Thanks [@lucas-barake](https://github.com/lucas-barake)! - Store both encoded and decoded values in lastSubmittedValues
  - Changed `lastSubmittedValues` to store `{ encoded, decoded }` instead of just encoded values
  - Only set `lastSubmittedValues` on successful validation (not on validation failure)
  - Added performance optimizations to dirty field tracking with early returns for reference equality
  - Simplified auto-submit initialization by removing unnecessary microtask

### Patch Changes

- Updated dependencies [[`09d48cc`](https://github.com/lucas-barake/effect-form/commit/09d48cc36728324f0a63baebb12d00a5c7f1a579)]:
  - @lucas-barake/effect-form@0.6.0

## 0.6.0

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

### Patch Changes

- Updated dependencies [[`aa80cc6`](https://github.com/lucas-barake/effect-form/commit/aa80cc66505d230b3ca0cf51419a89afd2dd4255)]:
  - @lucas-barake/effect-form@0.5.0

## 0.5.0

### Minor Changes

- [#8](https://github.com/lucas-barake/effect-form/pull/8) [`3033994`](https://github.com/lucas-barake/effect-form/commit/30339948f9b05c13507274569a5f8d4aeeef2392) Thanks [@lucas-barake](https://github.com/lucas-barake)! - **BREAKING CHANGE**: Restructured `FieldComponentProps` to support custom props in field components.

  Field components now receive `{ field, props }` instead of flat props:

  ```tsx
  // Before
  const TextInput: React.FC<
    FormReact.FieldComponentProps<typeof Schema.String>
  > = ({ value, onChange, onBlur, error }) => (
    <input value={value} onChange={(e) => onChange(e.target.value)} />
  )

  // After
  const TextInput: React.FC<
    FormReact.FieldComponentProps<typeof Schema.String>
  > = ({ field }) => (
    <input
      value={field.value}
      onChange={(e) => field.onChange(e.target.value)}
    />
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

### Patch Changes

- Updated dependencies [[`046ec9f`](https://github.com/lucas-barake/effect-form/commit/046ec9f410161927bc38f767db63c4e1304f7a64)]:
  - @lucas-barake/effect-form@0.4.0

## 0.3.0

### Minor Changes

- [#4](https://github.com/lucas-barake/effect-form/pull/4) [`12dc7cc`](https://github.com/lucas-barake/effect-form/commit/12dc7cc1050d09e8c5c104f3a86d0d1afcc1ae8e) Thanks [@lucas-barake](https://github.com/lucas-barake)! - Add ability to track changes since last submit
  - `hasChangedSinceSubmit`: boolean indicating values differ from last submit
  - `lastSubmittedValues`: `Option<T>` containing the last submitted values
  - `revertToLastSubmit()`: restores form to last submitted state

  These APIs are available via both `useForm()` hook and `Subscribe` component.

### Patch Changes

- Updated dependencies [[`12dc7cc`](https://github.com/lucas-barake/effect-form/commit/12dc7cc1050d09e8c5c104f3a86d0d1afcc1ae8e)]:
  - @lucas-barake/effect-form@0.3.0

## 0.2.0

### Minor Changes

- [#2](https://github.com/lucas-barake/effect-form/pull/2) [`58c07b5`](https://github.com/lucas-barake/effect-form/commit/58c07b594473c3ca497b29795146ead7521f9cf0) Thanks [@lucas-barake](https://github.com/lucas-barake)! - Extract Field module from Form
  - Add dedicated `Field` module with field definitions, constructors, type helpers, and guards
  - `Field.makeField`, `Field.makeArrayField` for creating field definitions
  - `Field.isFieldDef`, `Field.isArrayFieldDef` type guards
  - `Field.getDefaultEncodedValues`, `Field.createTouchedRecord` helpers
  - Re-export `Field` from `@lucas-barake/effect-form-react` for convenience

### Patch Changes

- Updated dependencies [[`58c07b5`](https://github.com/lucas-barake/effect-form/commit/58c07b594473c3ca497b29795146ead7521f9cf0)]:
  - @lucas-barake/effect-form@0.2.0

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

### Patch Changes

- Updated dependencies [[`3818818`](https://github.com/lucas-barake/effect-form/commit/381881893ac58a500f69c2379ae556f55c07356c)]:
  - @lucas-barake/effect-form@0.1.0
