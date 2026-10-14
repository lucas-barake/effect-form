# @lucas-barake/effect-form

Type-safe forms powered by Effect Schema.

> [!NOTE]
> Requires **Effect v4** (4.0.0 or later). Effect v3 is no longer supported. The last releases for Effect v3 are `@lucas-barake/effect-form@0.25.0` and `@lucas-barake/effect-form-react@0.26.0`.

## Installation

Requires Effect 4.0.0 or later, React 19, and `@effect/atom-react` 4.0.0 or later.

```bash
pnpm add @lucas-barake/effect-form-react effect@^4.0.0 @effect/atom-react@^4.0.0
```

## 1. Basic Form Setup

```tsx
import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { FormBuilder, FormReact } from "@lucas-barake/effect-form-react"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

const loginFormBuilder = FormBuilder.empty
  .addField("email", Schema.String.check(Schema.isNonEmpty()))
  .addField("password", Schema.String.check(Schema.isMinLength(8)))

const loginForm = FormReact.make(loginFormBuilder, {
  fields: {
    email: ({ field }) => (
      <div>
        <input
          value={field.value}
          onChange={(e) => field.onChange(e.target.value)}
          onBlur={field.onBlur}
        />
        {Option.isSome(field.error) && <span className="error">{field.error.value}</span>}
      </div>
    ),
    password: ({ field }) => (
      <div>
        <input
          type="password"
          value={field.value}
          onChange={(e) => field.onChange(e.target.value)}
          onBlur={field.onBlur}
        />
        {Option.isSome(field.error) && <span className="error">{field.error.value}</span>}
      </div>
    )
  },
  onSubmit: (_, { decoded }) => Effect.log(`Login: ${decoded.email}`)
})

// Subscribe to atoms anywhere in the tree
function SubmitButton() {
  const isDirty = useAtomValue(loginForm.isDirty)
  const submitResult = useAtomValue(loginForm.submit)
  const submit = useAtomSet(loginForm.submit)
  return (
    <button onClick={() => submit()} disabled={!isDirty || submitResult.waiting}>
      Login
    </button>
  )
}

function LoginPage() {
  return (
    <loginForm.Initialize defaultValues={{ email: "", password: "" }}>
      <loginForm.email />
      <loginForm.password />
      <SubmitButton />
    </loginForm.Initialize>
  )
}
```

## 2. Array Fields

```tsx
import { Field } from "@lucas-barake/effect-form-react"

const orderFormBuilder = FormBuilder.empty
  .addField("title", Schema.String)
  .addField(Field.makeArrayField("items", Schema.Struct({ name: Schema.String })))

const orderForm = FormReact.make(orderFormBuilder, {
  runtime,
  fields: {
    title: TitleInput,
    items: { name: ItemNameInput }
  },
  onSubmit: (_, { decoded }) => Effect.log(`Order: ${decoded.title}`)
})

function OrderPage() {
  return (
    <orderForm.Initialize defaultValues={{ title: "", items: [] }}>
      <orderForm.title />
      <orderForm.items>
        {({ items, append, remove, swap, move }) => (
          <>
            {items.map((_, index) => (
              <orderForm.items.Item key={index} index={index}>
                {({ remove }) => (
                  <div>
                    <orderForm.items.name />
                    <button type="button" onClick={remove}>
                      Remove
                    </button>
                  </div>
                )}
              </orderForm.items.Item>
            ))}
            <button type="button" onClick={() => append()}>
              Add Item
            </button>
            <button type="button" onClick={() => swap(0, 1)}>
              Swap 0 and 1
            </button>
            <button type="button" onClick={() => move(0, 2)}>
              Move 0 to 2
            </button>
          </>
        )}
      </orderForm.items>
    </orderForm.Initialize>
  )
}
```

## 3. Validation Modes

```tsx
FormReact.make(formBuilder, { fields, mode: { validation: "onSubmit" }, onSubmit })
FormReact.make(formBuilder, { fields, mode: { validation: "onBlur" }, onSubmit })
FormReact.make(formBuilder, { fields, mode: { validation: "onChange" }, onSubmit })
```

## 4. Cross-Field Validation (Sync Refinements)

```tsx
const signupForm = FormBuilder.empty
  .addField("password", Schema.String)
  .addField("confirmPassword", Schema.String)
  .refine((values) => {
    if (values.password !== values.confirmPassword) {
      // Route error to specific field
      return { path: ["confirmPassword"], message: "Passwords must match" }
      // Or return root-level error (no path): return "Passwords must match"
    }
  })

// Display root-level errors with form.rootError
const rootError = useAtomValue(form.rootError)
Option.isSome(rootError) && <div className="error">{rootError.value}</div>
```

## 5. Async Refinements

```tsx
const usernameForm = FormBuilder.empty
  .addField("username", Schema.String)
  .refineEffect((values) =>
    Effect.gen(function*() {
      yield* Effect.sleep("100 millis")
      const isTaken = values.username === "taken"
      if (isTaken) {
        return { path: ["username"], message: "Username is already taken" }
      }
    })
  )
```

## 6. Async Validation with Services

```tsx
import * as Context from "effect/Context"

class UsernameValidator extends Context.Tag("UsernameValidator")<
  UsernameValidator,
  { readonly isTaken: (username: string) => Effect.Effect<boolean> }
>() {}

const UsernameValidatorLive = Layer.succeed(UsernameValidator, {
  isTaken: (username) =>
    Effect.gen(function*() {
      yield* Effect.sleep("100 millis")
      return username === "taken"
    })
})

const runtime = Atom.runtime(UsernameValidatorLive)

const signupFormBuilder = FormBuilder.empty
  .addField("username", Schema.String)
  .refineEffect((values) =>
    Effect.gen(function*() {
      const validator = yield* UsernameValidator
      const isTaken = yield* validator.isTaken(values.username)
      if (isTaken) {
        return { path: ["username"], message: "Username is already taken" }
      }
    })
  )

const signupForm = FormReact.make(signupFormBuilder, {
  runtime,
  fields: { username: UsernameInput },
  onSubmit: (_, { decoded }) => Effect.log(`Signup: ${decoded.username}`)
})
```

## 7. getFieldAtoms and setValues

`getFieldAtoms` returns a bundle of safe per-field atoms. Use `useAtomSet` to call operations:

```tsx
function FormControls() {
  const emailAtoms = loginForm.getFieldAtoms(loginForm.fields.email)
  const passwordAtoms = loginForm.getFieldAtoms(loginForm.fields.password)

  const setEmail = useAtomSet(emailAtoms.setValue)
  const setPassword = useAtomSet(passwordAtoms.setValue)
  const setAllValues = useAtomSet(loginForm.setValues)

  return (
    <>
      <button onClick={() => setEmail("new@email.com")}>
        Set Email
      </button>

      <button onClick={() => setPassword((prev) => prev.toUpperCase())}>
        Uppercase Password
      </button>

      <button onClick={() => setAllValues({ email: "reset@email.com", password: "" })}>
        Reset to Defaults
      </button>
    </>
  )
}
```

> `setValues` is an `Atom.Writable` — you can also use `registry.update` from Atom's context for type-safe updater callbacks: `registry.update(form.setValues, (prev) => ({ ...prev, email: "new" }))`.

## 8. Auto-Submit Mode

```tsx
FormReact.make(formBuilder, {
  fields,
  mode: { validation: "onChange", debounce: "300 millis", autoSubmit: true },
  onSubmit
})

FormReact.make(formBuilder, {
  fields,
  mode: { validation: "onBlur", autoSubmit: true },
  onSubmit
})
```

## 9. Debounced Validation

```tsx
FormReact.make(formBuilder, {
  fields,
  mode: { validation: "onChange", debounce: "300 millis" },
  onSubmit
})
```

## 10. isDirty Tracking

```tsx
function FormStatus() {
  const isDirty = useAtomValue(loginForm.isDirty)
  const reset = useAtomSet(loginForm.reset)

  return (
    <>
      {isDirty && <span>You have unsaved changes</span>}
      <button onClick={() => reset()} disabled={!isDirty}>
        Reset
      </button>
    </>
  )
}

const EmailInput: FormReact.FieldComponent<string> = ({ field }) => (
  <div>
    <input
      value={field.value}
      onChange={(e) => field.onChange(e.target.value)}
      onBlur={field.onBlur}
    />
    {field.isDirty && <span>*</span>}
  </div>
)
```

## 11. Track Changes Since Submit

Track whether form values differ from the last submitted state. Useful for "revert to last submit" functionality and "unsaved changes since submit" indicators.

```tsx
function FormStatus() {
  const hasChangedSinceSubmit = useAtomValue(loginForm.hasChangedSinceSubmit)
  const lastSubmittedValues = useAtomValue(loginForm.lastSubmittedValues)
  const revertToLastSubmit = useAtomSet(loginForm.revertToLastSubmit)

  return (
    <>
      {hasChangedSinceSubmit && (
        <div>
          <span>You have unsaved changes since last submit</span>
          <button onClick={() => revertToLastSubmit()}>Revert to Last Submit</button>
        </div>
      )}
      {Option.isSome(lastSubmittedValues) && <span>Last submitted: {lastSubmittedValues.value.email}</span>}
    </>
  )
}
```

**State Lifecycle:**

| Action | values | lastSubmittedValues | isDirty | hasChangedSinceSubmit |
| ------ | ------ | ------------------- | ------- | --------------------- |
| Mount  | A      | None                | false   | false                 |
| Edit   | B      | None                | true    | false                 |
| Submit | B      | Some(B)             | true    | false                 |
| Edit   | C      | Some(B)             | true    | true                  |
| Revert | B      | Some(B)             | true    | false                 |
| Reset  | A      | None                | false   | false                 |

## 12. Subscribing to Form State

Subscribe to fine-grained atoms anywhere in the tree:

```tsx
import { useAtomSubscribe, useAtomValue } from "@effect/atom-react"

// Read atoms directly
function FormDebug() {
  const isDirty = useAtomValue(loginForm.isDirty)
  const submitCount = useAtomValue(loginForm.submitCount)
  const submitResult = useAtomValue(loginForm.submit)

  return (
    <pre>
      isDirty: {String(isDirty)}
      submitCount: {submitCount}
      waiting: {String(submitResult.waiting)}
    </pre>
  )
}

// Subscribe to changes with side effects
function FormSideEffects() {
  useAtomSubscribe(
    loginForm.isDirty,
    (isDirty) => {
      console.log("Dirty state changed:", isDirty)
    },
    { immediate: false }
  )

  return null
}
```

## 13. Subscribing to Individual Field State

Use `getFieldAtoms` to subscribe to a specific field's value, error, dirty state, touched state, or validation status without re-rendering when other fields change.
The `value` atom returns `Option<T>` - `None` before initialization, `Some(value)` after:

```tsx
function EmailDisplay() {
  const emailAtoms = loginForm.getFieldAtoms(loginForm.fields.email)
  const emailOption = useAtomValue(emailAtoms.value)

  return Option.match(emailOption, {
    onNone: () => <span>Loading...</span>,
    onSome: (email) => <span>Current email: {email}</span>
  })
}

function PasswordStrength() {
  const passwordAtoms = loginForm.getFieldAtoms(loginForm.fields.password)
  const passwordOption = useAtomValue(passwordAtoms.value)

  const password = Option.getOrThrow(passwordOption)
  const strength = password.length < 8 ? "weak" : password.length < 12 ? "medium" : "strong"
  return <span>Password strength: {strength}</span>
}

function FieldStatus() {
  const nameAtoms = loginForm.getFieldAtoms(loginForm.fields.username)
  const isDirty = useAtomValue(nameAtoms.isDirty)
  const isTouched = useAtomValue(nameAtoms.isTouched)
  const isValidating = useAtomValue(nameAtoms.isValidating)
  const error = useAtomValue(nameAtoms.error)

  return (
    <div>
      {isDirty && <span>Modified</span>}
      {isTouched && <span>Touched</span>}
      {isValidating && <span>Validating...</span>}
      {Option.isSome(error) && <span>{error.value}</span>}
    </div>
  )
}
```

## 14. Error Display Patterns

```tsx
const TextInput: FormReact.FieldComponent<string> = ({ field }) => (
  <div>
    <input
      value={field.value}
      onChange={(e) => field.onChange(e.target.value)}
      onBlur={field.onBlur}
    />
    {field.isValidating && <span>Validating...</span>}
    {Option.isSome(field.error) && <span className="error">{field.error.value}</span>}
  </div>
)

import * as AsyncResult from "effect/reactivity/AsyncResult"

function SubmitStatus() {
  const submitResult = useAtomValue(loginForm.submit)

  if (submitResult.waiting) return <span>Submitting...</span>
  if (AsyncResult.isSuccess(submitResult)) return <span>Success!</span>
  if (AsyncResult.isFailure(submitResult)) return <span>Failed</span>
  return null
}

// For side effects after submit (navigation, close dialog, etc.):
function FormWithSideEffects({ onClose }: { onClose: () => void }) {
  useAtomSubscribe(
    loginForm.submit,
    (result) => {
      if (AsyncResult.isSuccess(result)) {
        onClose()
      }
    },
    { immediate: false }
  )

  return <loginForm.Initialize defaultValues={{ email: "", password: "" }}>...</loginForm.Initialize>
}
```

## 15. Mapping Submit Failures to Field Errors

`onSubmit` only runs once the values pass the schema, so a server rejection arrives as the failure of `onSubmit`. `submitErrors` maps that failure to field errors, which show up through the same field components, `getFieldAtoms(ref).error` and `rootError` as schema errors:

```tsx
class SlugTaken extends Schema.TaggedError<SlugTaken>()("SlugTaken", {}) {}

class UpstreamValidation extends Schema.TaggedError<UpstreamValidation>()("UpstreamValidation", {
  issues: Schema.Array(Schema.Struct({ field: Schema.Literals(["slug", "title"]), message: Schema.String }))
}) {}

class UnknownProduct extends Schema.TaggedError<UnknownProduct>()("UnknownProduct", { index: Schema.Number }) {}

const siteForm = FormReact.make(siteFormBuilder, {
  runtime,
  fields: { slug: TextInput, title: TextInput, items: { name: TextInput } },
  onSubmit: (_, { decoded }) => api.createSite(decoded),
  submitErrors: (error) => {
    switch (error._tag) {
      case "SlugTaken":
        return [{ path: "slug", message: "This slug is already in use." }]
      case "UpstreamValidation":
        return error.issues.map((issue) => ({ path: issue.field, message: issue.message }))
      case "UnknownProduct":
        return [{ path: `items[${error.index}].name`, message: "Unknown product" }]
      default:
        return [{ path: "", message: "Could not save" }]
    }
  }
})
```

- `path` is `""` for the form-level error (shown by `rootError`), a field name, or a struct property of an array item such as `items[0].name`. A misspelled path, a nested struct path like `address.city`, and a plain `string` do not compile, so narrow server field names to the form's fields first. A path that matches no submitted field at runtime fails the submit with a defect instead of being dropped.
- `error` is inferred from `onSubmit`. TypeScript infers left to right, so declare `submitErrors` after `onSubmit`. In the other order `error` is `never` and the form fails to compile.
- The mapping runs only when the Effect returned by `onSubmit` fails with a typed error. Schema errors, defects and interruptions skip it, and so does a rejected Promise, which is a defect. A `submitErrors` that throws is a defect too.
- `form.submit` still fails with the original error, so notifications and navigation can keep reading the submit result. A failed submit does not update `lastSubmittedValues`.
- A field's submit error shows only while the field holds the value that was submitted. Edit the field and the error hides. Type the rejected value again and it comes back. A schema error on the field takes precedence.
- Array item errors belong to the index they were submitted at. Removing or reordering items moves the values but not the errors, so an item's error hides until the next submit, and shows on another item only if that item holds the same value at the same index.
- Submit errors last until the next submit, `reset` or re-initialization, and they survive `validate`. `revertToLastSubmit` and `setValues` clear the form-level one. `rootError` shows a schema form-level error first and falls back to the submit one.

### Running an Existing Mutation Atom

If the request already lives in a mutation atom, run it from `onSubmit` with `get.setResult`:

```ts
const createSiteAtom = runtime.fn((input: SiteInput) => api.createSite(input))

const siteForm = FormReact.make(siteFormBuilder, {
  runtime,
  fields: { slug: TextInput, title: TextInput, items: { name: TextInput } },
  onSubmit: (_, { decoded, get }) => get.setResult(createSiteAtom, decoded),
  submitErrors: (error) => error._tag === "SlugTaken" ? [{ path: "slug", message: "This slug is already in use." }] : []
})
```

`get.setResult` writes `decoded` to `createSiteAtom`, so everything watching that atom sees the run, and returns an Effect that fails with the atom's error, which is what `submitErrors` receives. Interrupting the submit, for example by submitting again, stops waiting for the mutation, but a mutation atom that something else keeps mounted runs to completion.

### Error Summaries

`form.fieldErrors` lists every error the form's fields currently display, keyed by path in field order, array item paths included:

```tsx
function ErrorSummary() {
  const errors = useAtomValue(siteForm.fieldErrors)
  if (errors.size === 0) return null
  return (
    <ul>
      {[...errors].map(([path, message]) => <li key={path}>{message}</li>)}
    </ul>
  )
}
```

It follows the same rules as the fields: submit errors appear only while their value is unchanged, and errors stay hidden until the validation mode shows them. The form-level error is in `rootError`.

## 16. Custom Submit Arguments

Pass custom arguments to `onSubmit` by annotating the first parameter:

```tsx
// Define form with custom submit args
const contactForm = FormReact.make(contactFormBuilder, {
  runtime,
  fields: { email: TextInput, message: TextInput },
  onSubmit: (args: { source: string }, { decoded, encoded, get }) =>
    Effect.log(`Contact from ${args.source}: ${decoded.email}`)
})

// Pass args when submitting
function SubmitButton({ source }: { source: string }) {
  const submit = useAtomSet(contactForm.submit)
  return <button onClick={() => submit({ source })}>Send</button>
}
```

The `onSubmit` callback receives:

- `args` - Custom arguments passed to `submit(args)`
- `decoded` - Schema-decoded values
- `encoded` - Raw encoded values
- `get` - Atom context for reading/writing other atoms

> **Note:** Auto-submit mode is only available when `args` is `void`. TypeScript will prevent using `autoSubmit: true` with custom arguments since there's no way to provide them automatically.

## 17. Reactivity (Query Invalidation)

Invalidate reactive queries (`AtomRpc`, `AtomHttpApi`, etc.) after successful form submission using `reactivityKeys`:

```tsx
import * as Atom from "effect/reactivity/Atom"

const userListAtom = runtime.atom(fetchUsers).pipe(
  Atom.withReactivity(["users"])
)

const createUserForm = FormReact.make(formBuilder, {
  runtime,
  fields: { name: TextInput, email: TextInput },
  reactivityKeys: ["users"],
  onSubmit: (_, { decoded }) => createUser(decoded)
})
```

After a successful submit, all atoms registered with matching keys will rebuild. Invalidation does **not** fire on validation failure or `onSubmit` effect failure.

## 18. Reusable Field Definitions

For fields shared across multiple forms, use `Field.makeField` to define them once:

```tsx
import { Field, FormBuilder, FormReact } from "@lucas-barake/effect-form-react"

// Define reusable field
const EmailField = Field.makeField(
  "email",
  Schema.String.check(Schema.isPattern(/@/), Schema.isNonEmpty())
)

// Use in multiple forms
const loginForm = FormBuilder.empty
  .addField(EmailField)
  .addField("password", Schema.String)

const signupForm = FormBuilder.empty
  .addField(EmailField)
  .addField("password", Schema.String)
  .addField("name", Schema.String)

const newsletterForm = FormBuilder.empty
  .addField(EmailField)
```

You can also compose reusable field groups using `merge`:

```tsx
const addressFields = FormBuilder.empty
  .addField("street", Schema.String)
  .addField("city", Schema.String)
  .addField("zip", Schema.String)

const shippingForm = FormBuilder.empty
  .addField("name", Schema.String)
  .merge(addressFields)

const billingForm = FormBuilder.empty
  .addField("cardNumber", Schema.String)
  .merge(addressFields)
```

## 19. Persisting State Across Unmounts (KeepAlive)

By default, form state is destroyed when `Initialize` unmounts. For multi-step wizards or conditional fields where you want state to persist, use `KeepAlive`:

```tsx
function MultiStepWizard() {
  const [step, setStep] = useState(1)

  return (
    <div>
      {/* Keep form state alive even when steps unmount */}
      <step1Form.KeepAlive />
      <step2Form.KeepAlive />

      {step === 1 && <Step1 onNext={() => setStep(2)} />}
      {step === 2 && <Step2 onBack={() => setStep(1)} />}
    </div>
  )
}

function Step1({ onNext }: { onNext: () => void }) {
  return (
    <step1Form.Initialize defaultValues={{ name: "" }}>
      <step1Form.name />
      <button onClick={onNext}>Next</button>
    </step1Form.Initialize>
  )
}
```

Without `KeepAlive`, navigating from Step1 to Step2 and back would lose all Step1 data. With `KeepAlive` at the wizard root, state persists across step changes.

**When to use:**

- Multi-step wizards where steps unmount
- Conditional fields (toggles between optional inputs)
- Tab-based forms where inactive tabs unmount

**Alternative: Hook-based mounting**

For more control, use `useAtomMount` with the `mount` atom directly:

```tsx
import { useAtomMount } from "@effect/atom-react"

function Wizard() {
  useAtomMount(step1Form.mount)
  useAtomMount(step2Form.mount)
  // ...
}
```

## 20. Validate on Initialize

Validate persisted or pre-filled default values on mount. Useful when restoring form state from local storage:

```tsx
<form.Initialize defaultValues={savedValues} validateOnInit>
  {children}
</form.Initialize>
```

You can also trigger validation imperatively at any point:

```tsx
const triggerValidate = useAtomSet(form.validate)
triggerValidate()
```

Unlike `submit`, `validate` only runs schema validation and shows errors. It does not call `onSubmit`, bump `submitCount`, or store `lastSubmittedValues`.

## 21. defaultValues Are Read Once

`Initialize` reads `defaultValues` on mount only — changing the prop on a mounted form is intentionally ignored (your users' in-progress edits are never clobbered by a re-render). To load new values into a live form, write them with `form.setValues`; to fully re-initialize (new initial values, cleared dirty/touched/submit state), remount `Initialize` with a `key`:

```tsx
// Update values in place — dirty tracking still compares against the original defaults
const setValues = useAtomSet(form.setValues)
setValues(fetchedUser)

// Re-initialize from scratch when the underlying entity changes
<form.Initialize key={userId} defaultValues={userValues}>
  {children}
</form.Initialize>
```

> Remounting re-initializes because form state is disposed when `Initialize` unmounts — unless a `KeepAlive` is mounted (section 19), in which case the existing state survives and `defaultValues` is ignored on the next mount.

## Available Atoms

All forms expose these atoms for fine-grained subscriptions:

```ts
form.values // Atom<Option<EncodedValues>> - current form values
form.isDirty // Atom<boolean> - values differ from initial
form.hasChangedSinceSubmit // Atom<boolean> - values differ from last submit
form.lastSubmittedValues // Atom<Option<SubmittedValues>> - last submitted values
form.submitCount // Atom<number> - number of submit attempts
form.rootError // Atom<Option<string>> - root-level validation error (cross-field refinements without path)
form.fieldErrors // Atom<ReadonlyMap<FieldPath, string>> - every displayed field error, array item paths included
form.submit // AtomResultFn<SubmitArgs, A, E | SchemaError> - submit with .waiting, ._tag
form.validate // AtomResultFn<void, void> - trigger schema validation without submitting
form.validationCount // Atom<number> - number of validate() calls
form.mount // Atom<void> - root anchor for state persistence (use with useAtomMount)

form.getFieldAtoms(fieldRef).value // Atom<Option<FieldValue>> - field value (None before init)
form.getFieldAtoms(fieldRef).error // Atom<Option<string>> - display error
form.getFieldAtoms(fieldRef).isDirty // Atom<boolean> - field dirty state
form.getFieldAtoms(fieldRef).isTouched // Atom<boolean> - field touched state
form.getFieldAtoms(fieldRef).isValidating // Atom<boolean> - field validation in progress
form.getFieldAtoms(fieldRef).setValue // Writable<void, T | (T => T)> - set field value
form.getFieldAtoms(fieldRef).setTouched // Writable<void, boolean> - set field touched
form.getFieldAtoms(fieldRef).validate // Writable<void, void> - trigger field validation and show error
```

> **Why `Option` for `values`?** Returns `None` before the form is initialized, `Some(values)` after. This allows parent components to safely subscribe and wait for initialization without throwing.

## Available Operations

Operations are AtomResultFns - use `useAtomSet` to invoke:

```ts
form.reset // AtomResultFn<void> - reset to initial values
form.revertToLastSubmit // AtomResultFn<void> - revert to last submit
form.setValues // Writable<Values> - set all values (supports updater via registry.update)
form.submit // AtomResultFn<void, A, E> - trigger submit (handler defined at build)
form.validate // AtomResultFn<void> - trigger full schema validation without submitting
```

## Field Component Props Reference

```ts
interface FieldState<E,> {
  path: string // Dot-notation path identifying the field (e.g. "name", "items[0].street")
  value: E // Current field value (encoded type)
  onChange: (value: E) => void
  onBlur: () => void
  error: Option.Option<string> // Validation error (shown after touch/submit)
  isTouched: boolean // Field has been blurred
  isValidating: boolean // Async validation in progress
  isDirty: boolean // Value differs from initial
}

interface FieldComponentProps<E, P = {},> {
  field: FieldState<E> // Form-controlled state
  props: P // Custom props passed at render time
}

// Helper type for defining field components
type FieldComponent<T, P = {},> = React.FC<FieldComponentProps<FieldValue<T>, P>>
```

### Defining Field Components

Use `FieldComponent<T>` to define reusable field components. You can pass either:

- A value type directly: `FieldComponent<string>`
- A Schema type: `FieldComponent<typeof Schema.String>` (extracts the encoded type)

```tsx
// With value type (recommended)
const TextInput: FormReact.FieldComponent<string> = ({ field }) => (
  <input
    value={field.value}
    onChange={(e) => field.onChange(e.target.value)}
    onBlur={field.onBlur}
  />
)

// With Schema type
const TextInput: FormReact.FieldComponent<typeof Schema.String> = ({ field }) => (
  <input
    value={field.value}
    onChange={(e) => field.onChange(e.target.value)}
    onBlur={field.onBlur}
  />
)

// With custom props
const TextInput: FormReact.FieldComponent<string, { placeholder?: string }> = ({ field, props }) => (
  <input
    value={field.value}
    onChange={(e) => field.onChange(e.target.value)}
    placeholder={props.placeholder}
  />
)

// Pass props at render time
<LoginForm.email placeholder="Enter email" />
```

Components typed with value types can be reused across schemas with the same encoded type:

```tsx
const TextInput: FormReact.FieldComponent<string> = ({ field }) => (
  <input
    value={field.value}
    onChange={(e) => field.onChange(e.target.value)}
  />
)

const form = FormReact.make(formBuilder, {
  fields: {
    name: TextInput,
    age: TextInput
  },
  onSubmit
})
```

## License

MIT
