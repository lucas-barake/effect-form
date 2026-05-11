# @lucas-barake/effect-form

## 0.25.0-beta.5

### Patch Changes

- [#89](https://github.com/lucas-barake/effect-form/pull/89) [`cc64852`](https://github.com/lucas-barake/effect-form/commit/cc648525467a09b1908c7903428cb5a6ef349271) Thanks [@tim-smart](https://github.com/tim-smart)! - update effect

## 0.25.0-beta.4

### Patch Changes

- [#85](https://github.com/lucas-barake/effect-form/pull/85) [`ef7cc0d`](https://github.com/lucas-barake/effect-form/commit/ef7cc0dbf2b3d1ea78107ddcc46d3c8f093bbab5) Thanks [@lucas-barake](https://github.com/lucas-barake)! - update effect to v4 beta.52

## 0.25.0-beta.3

### Patch Changes

- [#83](https://github.com/lucas-barake/effect-form/pull/83) [`6cc58b2`](https://github.com/lucas-barake/effect-form/commit/6cc58b27d16fe802f6e6ca488aa7cb04e847b06a) Thanks [@lucas-barake](https://github.com/lucas-barake)! - update effect to beta.18

## 0.25.0-beta.2

### Minor Changes

- [#81](https://github.com/lucas-barake/effect-form/pull/81) [`cb68e9e`](https://github.com/lucas-barake/effect-form/commit/cb68e9ed1f9270a1b9d68beacdbb7825119c3d74) Thanks [@lucas-barake](https://github.com/lucas-barake)! - Expose `path` property in `FieldState` for use in field `name` and `id` attributes.

### Patch Changes

- [#81](https://github.com/lucas-barake/effect-form/pull/81) [`cb68e9e`](https://github.com/lucas-barake/effect-form/commit/cb68e9ed1f9270a1b9d68beacdbb7825119c3d74) Thanks [@lucas-barake](https://github.com/lucas-barake)! - Update effect peer dependency to v4 beta.14.

## 0.25.0-beta.1

### Patch Changes

- [#77](https://github.com/lucas-barake/effect-form/pull/77) [`4b1a8b1`](https://github.com/lucas-barake/effect-form/commit/4b1a8b154286e7149cb7318d029de7d2deb0e713) Thanks [@BleedingDev](https://github.com/BleedingDev)! - Update for Effect v4 beta.10: `Duration.DurationInput` to `Duration.Input`, `Duration.fromDurationInputUnsafe` to `Duration.fromInputUnsafe`, `Schema.decodeTo` now takes `SchemaGetter` instances.

## 0.25.0-beta.0

### Minor Changes

- [#76](https://github.com/lucas-barake/effect-form/pull/76) [`495dbc7`](https://github.com/lucas-barake/effect-form/commit/495dbc789522a431ed8e33e42c7dacf1c3acc278) Thanks [@github-actions](https://github.com/apps/github-actions)! - Migrate to Effect v4 beta

  - Update all Schema APIs: `Schema.Schema.Any` → `Schema.Top`, `Schema.Schema.Encoded` → `Schema.Codec.Encoded`, `Schema.Schema.Context` → `Schema.Codec.DecodingServices`
  - Update SchemaAST tag names: `StringKeyword` → `String`, `NumberKeyword` → `Number`, `BooleanKeyword` → `Boolean`, `NeverKeyword` → `Never`, `TypeLiteral` → `Objects`, `TupleType` → `Arrays`, `Enums` → `Enum`
  - Replace `ParseResult.ParseError` with `Schema.SchemaError` throughout
  - Replace `Schema.decodeUnknown` with `Schema.decodeUnknownEffect`
  - Replace `Cause.failureOption` with `Cause.findErrorOption`
  - Replace `Schema.filter`/`Schema.filterEffect` with `Schema.check(Schema.makeFilter(...))` and `Schema.decode({ decode: SchemaGetter.checkEffect(...), encode: SchemaGetter.passthrough() })`
  - Rewrite `Validation.ts` issue tree walker for v4 issue types (`Filter`, `Encoding`, `AnyOf`, `InvalidType`, etc.)
  - Update formatter to `SchemaIssue.makeFormatterStandardSchemaV1()`
  - Remove `Utils.structuralRegion` (structural equality is default in v4)
  - Update atom imports from `@effect-atom/atom` to `effect/unstable/reactivity/Atom`
  - Update atom-react imports from `@effect-atom/atom-react` to `@effect/atom-react`
  - Drop React 18 support (v4 atom-react requires React 19)

## 0.24.0

### Minor Changes

- [#73](https://github.com/lucas-barake/effect-form/pull/73) [`80f9f29`](https://github.com/lucas-barake/effect-form/commit/80f9f29dd6449a718ab2f8021cc30f81faa3a987) Thanks [@lucas-barake](https://github.com/lucas-barake)! - add per-field validate to PublicFieldAtoms

## 0.23.0

### Minor Changes

- [#71](https://github.com/lucas-barake/effect-form/pull/71) [`e13e3c7`](https://github.com/lucas-barake/effect-form/commit/e13e3c7699747313123d59df495c5bc6cd3a07eb) Thanks [@lucas-barake](https://github.com/lucas-barake)! - add `validate` atom and `validateOnInit` prop for triggering schema validation without submitting

## 0.22.0

### Minor Changes

- [#67](https://github.com/lucas-barake/effect-form/pull/67) [`eca7665`](https://github.com/lucas-barake/effect-form/commit/eca7665e3fac4a690143419c1ba7d1c6f274efc0) Thanks [@lucas-barake](https://github.com/lucas-barake)! - use `Atom.Writable` for `setValues` instead of manual updater function handling — updater callbacks are supported out of the box via `registry.update`

## 0.21.0

### Minor Changes

- [#65](https://github.com/lucas-barake/effect-form/pull/65) [`da3db87`](https://github.com/lucas-barake/effect-form/commit/da3db87a3b3092b2a0b5a648addbbf0a2b9b2d32) Thanks [@lucas-barake](https://github.com/lucas-barake)! - support updater function for `setValues`

## 0.20.0

### Minor Changes

- [#61](https://github.com/lucas-barake/effect-form/pull/61) [`3ef2f2c`](https://github.com/lucas-barake/effect-form/commit/3ef2f2c4ac73a247a7a75d24f255b3d9d941b7fa) Thanks [@lucas-barake](https://github.com/lucas-barake)! - Move validation, error display, and auto-submit logic into the core package so bindings are leaner. Refactor the mode configuration shape to `{ validation, debounce, autoSubmit }`. Support `Schema.filterEffect` in field definitions and array item schemas. Replace `setValue`, `getFieldValue`, and `getFieldIsDirty` with a single `getFieldAtoms(fieldRef)` accessor that returns a bundle of safe per-field atoms: `value`, `error`, `isDirty`, `isTouched`, `isValidating`, `setValue`, and `setTouched`.

## 0.19.0

### Minor Changes

- [#58](https://github.com/lucas-barake/effect-form/pull/58) [`c36e40d`](https://github.com/lucas-barake/effect-form/commit/c36e40d464995c82536dc42f5d5d67b756d773b5) Thanks [@lucas-barake](https://github.com/lucas-barake)! - add `reactivityKeys` option to invalidate reactive queries after successful form submission

## 0.18.0

### Minor Changes

- [#52](https://github.com/lucas-barake/effect-form/pull/52) [`f1c4e93`](https://github.com/lucas-barake/effect-form/commit/f1c4e934c8a7edcedc7680d48c2da75d105b4941) Thanks [@lucas-barake](https://github.com/lucas-barake)! - update @effect-atom peer dependency to ^0.5.0

## 0.17.0

### Minor Changes

- [#48](https://github.com/lucas-barake/effect-form/pull/48) [`dbfe27d`](https://github.com/lucas-barake/effect-form/commit/dbfe27d85310d6bf52256c2ffead05dedbef9b7f) Thanks [@lucas-barake](https://github.com/lucas-barake)! - rename getFieldAtom to getFieldValue

## 0.16.0

### Minor Changes

- [#45](https://github.com/lucas-barake/effect-form/pull/45) [`2fc45d4`](https://github.com/lucas-barake/effect-form/commit/2fc45d483d512a61238cc694ed7a4eb62a032ec1) Thanks [@lucas-barake](https://github.com/lucas-barake)! - add getFieldIsDirty for per-field dirty subscriptions

## 0.15.0

### Minor Changes

- [#43](https://github.com/lucas-barake/effect-form/pull/43) [`25d0da1`](https://github.com/lucas-barake/effect-form/commit/25d0da132f6cedbace49a284e1995e42ff6a43b6) Thanks [@lucas-barake](https://github.com/lucas-barake)! - expose per-field isDirtyAtom on FieldAtoms

## 0.14.0

### Minor Changes

- [#40](https://github.com/lucas-barake/effect-form/pull/40) [`a69a9ec`](https://github.com/lucas-barake/effect-form/commit/a69a9ec02b828aa4b40e8d8ad973169758e17ffd) Thanks [@lucas-barake](https://github.com/lucas-barake)! - Add `FieldValue<T>` and `FieldComponent<T, P>` helper types for defining field components. Components can now use either value types (`FieldComponent<string>`) or Schema types (`FieldComponent<typeof Schema.NumberFromString>`). Remove unused `forField`, `makeField`, and `FieldBundle` APIs. Remove redundant JSDoc comments.

## 0.13.0

### Minor Changes

- [#37](https://github.com/lucas-barake/effect-form/pull/37) [`7fb5c96`](https://github.com/lucas-barake/effect-form/commit/7fb5c96823916c95d04c8763bfe1baf7ed77c3a7) Thanks [@lucas-barake](https://github.com/lucas-barake)! - Fix nested struct refinements being incorrectly classified as top-level refinements. Refinements on nested composite types (e.g., a field with `Schema.Struct(...).pipe(Schema.filterEffect(...))`) are now tagged with `source: "field"` instead of `source: "refinement"`, allowing field errors to clear when the user provides valid input.

## 0.12.0

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

## 0.11.0

### Minor Changes

- [#30](https://github.com/lucas-barake/effect-form/pull/30) [`8b45cec`](https://github.com/lucas-barake/effect-form/commit/8b45cece1fbcac05e9139e4134ab73646f222081) Thanks [@lucas-barake](https://github.com/lucas-barake)! - Make `getFieldAtom` return `Option.Option<S>` instead of throwing when accessed before initialization

  **Breaking Change:**

  `getFieldAtom` now returns `Atom<Option.Option<S>>` instead of `Atom<S>`. This prevents crashes when subscribing before `<form.Initialize>` mounts.

  ```tsx
  // Before (would crash if used outside Initialize)
  const email = useAtomValue(form.getFieldAtom(form.fields.email));

  // After (safe to use anywhere)
  const emailOption = useAtomValue(form.getFieldAtom(form.fields.email));
  return Option.match(emailOption, {
    onNone: () => <span>Loading...</span>,
    onSome: (email) => <span>{email}</span>,
  });
  ```

  Internal field components are unaffected - they still use the efficient direct access since they're guaranteed to run inside `<Initialize>`.

## 0.10.0

### Minor Changes

- [#25](https://github.com/lucas-barake/effect-form/pull/25) [`40d8018`](https://github.com/lucas-barake/effect-form/commit/40d80183313333c7615993ff5d84bf995c218b89) Thanks [@lucas-barake](https://github.com/lucas-barake)! - Add inline `addField` shorthand and per-field subscriptions via `getFieldAtom`

  **New Features:**

  1. **Inline `addField` syntax** - Define fields without `Field.makeField` for one-off fields:
     ```ts
     FormBuilder.empty
       .addField("email", Schema.String)
       .addField("age", Schema.Number);
     ```
     Use `Field.makeField` when you need to share fields across multiple forms.
  2. **Per-field subscriptions** - Subscribe to individual field values without re-rendering when other fields change:
     ```ts
     const emailAtom = form.getFieldAtom(form.fields.email);
     const email = useAtomValue(emailAtom); // Only re-renders when email changes
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
    console.log(values);
    return { success: true };
  });

  // Still works - Effect
  const handleSubmit = MyForm.submit((values) =>
    Effect.log(`Submitted: ${values.email}`)
  );
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
