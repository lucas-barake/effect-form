# @lucas-barake/effect-form

Type-safe forms powered by Effect Schema.

## Installation

```bash
pnpm add @lucas-barake/effect-form-react
```

## 1. Basic Form Setup

```tsx
import { FormBuilder, FormReact } from "@lucas-barake/effect-form-react"
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react"
import * as Schema from "effect/Schema"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"

const loginFormBuilder = FormBuilder.empty
  .addField("email", Schema.String.pipe(Schema.nonEmptyString()))
  .addField("password", Schema.String.pipe(Schema.minLength(8)))

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
    ),
  },
  onSubmit: (_, { decoded }) => Effect.log(`Login: ${decoded.email}`),
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
    items: { name: ItemNameInput },
  },
  onSubmit: (_, { decoded }) => Effect.log(`Order: ${decoded.title}`),
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
FormReact.make(formBuilder, { fields, mode: "onSubmit", onSubmit })
FormReact.make(formBuilder, { fields, mode: "onBlur", onSubmit })
FormReact.make(formBuilder, { fields, mode: "onChange", onSubmit })
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
    Effect.gen(function* () {
      yield* Effect.sleep("100 millis")
      const isTaken = values.username === "taken"
      if (isTaken) {
        return { path: ["username"], message: "Username is already taken" }
      }
    }),
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
    Effect.gen(function* () {
      yield* Effect.sleep("100 millis")
      return username === "taken"
    }),
})

const runtime = Atom.runtime(UsernameValidatorLive)

const signupFormBuilder = FormBuilder.empty
  .addField("username", Schema.String)
  .refineEffect((values) =>
    Effect.gen(function* () {
      const validator = yield* UsernameValidator
      const isTaken = yield* validator.isTaken(values.username)
      if (isTaken) {
        return { path: ["username"], message: "Username is already taken" }
      }
    }),
  )

const signupForm = FormReact.make(signupFormBuilder, {
  runtime,
  fields: { username: UsernameInput },
  onSubmit: (_, { decoded }) => Effect.log(`Signup: ${decoded.username}`),
})
```

## 7. setValue and setValues

Operations are AtomResultFns - use `useAtomSet` to call them:

```tsx
function FormControls() {
  const setEmail = useAtomSet(loginForm.setValue(loginForm.fields.email))
  const setPassword = useAtomSet(loginForm.setValue(loginForm.fields.password))
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

## 8. Auto-Submit Mode

```tsx
FormReact.make(formBuilder, {
  fields,
  mode: { onChange: { debounce: "300 millis", autoSubmit: true } },
  onSubmit,
})

FormReact.make(formBuilder, {
  fields,
  mode: { onBlur: { autoSubmit: true } },
  onSubmit,
})
```

## 9. Debounced Validation

```tsx
FormReact.make(formBuilder, {
  fields,
  mode: { onChange: { debounce: "300 millis" } },
  onSubmit,
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
      {Option.isSome(lastSubmittedValues) && (
        <span>Last submitted: {lastSubmittedValues.value.email}</span>
      )}
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
import { useAtomValue, useAtomSubscribe } from "@effect-atom/atom-react"

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
    { immediate: false },
  )

  return null
}
```

## 13. Subscribing to Individual Field Values

Use `getFieldAtom` to subscribe to a specific field's value without re-rendering when other fields change.
The atom returns `Option<T>` - `None` before initialization, `Some(value)` after:

```tsx
function EmailDisplay() {
  // Only re-renders when email changes, not when password changes
  const emailAtom = loginForm.getFieldAtom(loginForm.fields.email)
  const emailOption = useAtomValue(emailAtom)

  // Safe to use outside Initialize - returns None before form mounts
  return Option.match(emailOption, {
    onNone: () => <span>Loading...</span>,
    onSome: (email) => <span>Current email: {email}</span>,
  })
}

// Inside Initialize where state is guaranteed
function PasswordStrength() {
  const passwordAtom = loginForm.getFieldAtom(loginForm.fields.password)
  const passwordOption = useAtomValue(passwordAtom)

  // Can safely getOrThrow inside Initialize
  const password = Option.getOrThrow(passwordOption)
  const strength = password.length < 8 ? "weak" : password.length < 12 ? "medium" : "strong"
  return <span>Password strength: {strength}</span>
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

import * as Result from "@effect-atom/atom/Result"

function SubmitStatus() {
  const submitResult = useAtomValue(loginForm.submit)

  if (submitResult.waiting) return <span>Submitting...</span>
  if (Result.isSuccess(submitResult)) return <span>Success!</span>
  if (Result.isFailure(submitResult)) return <span>Failed</span>
  return null
}

// For side effects after submit (navigation, close dialog, etc.):
function FormWithSideEffects({ onClose }: { onClose: () => void }) {
  useAtomSubscribe(
    loginForm.submit,
    (result) => {
      if (Result.isSuccess(result)) {
        onClose()
      }
    },
    { immediate: false },
  )

  return <loginForm.Initialize defaultValues={{ email: "", password: "" }}>...</loginForm.Initialize>
}
```

## 15. Custom Submit Arguments

Pass custom arguments to `onSubmit` by annotating the first parameter:

```tsx
// Define form with custom submit args
const contactForm = FormReact.make(contactFormBuilder, {
  runtime,
  fields: { email: TextInput, message: TextInput },
  onSubmit: (args: { source: string }, { decoded, encoded, get }) =>
    Effect.log(`Contact from ${args.source}: ${decoded.email}`),
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

## 16. Reusable Field Definitions

For fields shared across multiple forms, use `Field.makeField` to define them once:

```tsx
import { Field, FormBuilder, FormReact } from "@lucas-barake/effect-form-react"

// Define reusable field
const EmailField = Field.makeField(
  "email",
  Schema.String.pipe(Schema.pattern(/@/), Schema.nonEmptyString()),
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

## 17. Persisting State Across Unmounts (KeepAlive)

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
import { useAtomMount } from "@effect-atom/atom-react"

function Wizard() {
  useAtomMount(step1Form.mount)
  useAtomMount(step2Form.mount)
  // ...
}
```

## Available Atoms

All forms expose these atoms for fine-grained subscriptions:

```ts
form.values                  // Atom<Option<EncodedValues>> - current form values
form.isDirty                 // Atom<boolean> - values differ from initial
form.hasChangedSinceSubmit   // Atom<boolean> - values differ from last submit
form.lastSubmittedValues     // Atom<Option<SubmittedValues>> - last submitted values
form.submitCount             // Atom<number> - number of submit attempts
form.rootError               // Atom<Option<string>> - root-level validation error (cross-field refinements without path)
form.submit                  // AtomResultFn<SubmitArgs, A, E | ParseError> - submit with .waiting, ._tag
form.getFieldAtom(fieldRef)  // Atom<Option<FieldValue>> - subscribe to individual field values (None before init)
form.mount                   // Atom<void> - root anchor for state persistence (use with useAtomMount)
```

> **Why `Option` for `values`?** Returns `None` before the form is initialized, `Some(values)` after. This allows parent components to safely subscribe and wait for initialization without throwing.

## Available Operations

Operations are AtomResultFns - use `useAtomSet` to invoke:

```ts
form.reset                         // AtomResultFn<void> - reset to initial values
form.revertToLastSubmit            // AtomResultFn<void> - revert to last submit
form.setValues                     // AtomResultFn<Values> - set all values
form.setValue(field)               // (FieldRef) => AtomResultFn<T | (T => T)> - set single field
form.submit                        // AtomResultFn<void, A, E> - trigger submit (handler defined at build)
```

## Field Component Props Reference

```ts
interface FieldState<E> {
  value: E // Current field value (encoded type)
  onChange: (value: E) => void
  onBlur: () => void
  error: Option.Option<string> // Validation error (shown after touch/submit)
  isTouched: boolean // Field has been blurred
  isValidating: boolean // Async validation in progress
  isDirty: boolean // Value differs from initial
}

interface FieldComponentProps<E, P = {}> {
  field: FieldState<E> // Form-controlled state
  props: P // Custom props passed at render time
}

// Helper type for defining field components
type FieldComponent<T, P = {}> = React.FC<FieldComponentProps<FieldValue<T>, P>>
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
  <input value={field.value} onChange={(e) => field.onChange(e.target.value)} />
)

const form = FormReact.make(formBuilder, {
  fields: {
    name: TextInput,
    age: TextInput,
  },
  onSubmit,
})
```

## License

MIT
