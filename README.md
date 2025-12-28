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
import * as Atom from "@effect-atom/atom/Atom"
import * as Schema from "effect/Schema"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Layer from "effect/Layer"

const runtime = Atom.runtime(Layer.empty)

const loginFormBuilder = FormBuilder.empty
  .addField("email", Schema.String.pipe(Schema.nonEmptyString()))
  .addField("password", Schema.String.pipe(Schema.minLength(8)))

const LoginForm = FormReact.build(loginFormBuilder, {
  runtime,
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
  const isDirty = useAtomValue(LoginForm.isDirty)
  const submitResult = useAtomValue(LoginForm.submit)
  const submit = useAtomSet(LoginForm.submit)
  return (
    <button onClick={() => submit()} disabled={!isDirty || submitResult.waiting}>
      Login
    </button>
  )
}

function LoginPage() {
  return (
    <LoginForm.Initialize defaultValues={{ email: "", password: "" }}>
      <LoginForm.email />
      <LoginForm.password />
      <SubmitButton />
    </LoginForm.Initialize>
  )
}
```

## 2. Array Fields

```tsx
import { Field } from "@lucas-barake/effect-form-react"

const orderFormBuilder = FormBuilder.empty
  .addField("title", Schema.String)
  .addField(Field.makeArrayField("items", Schema.Struct({ name: Schema.String })))

const OrderForm = FormReact.build(orderFormBuilder, {
  runtime,
  fields: {
    title: TitleInput,
    items: { name: ItemNameInput },
  },
  onSubmit: (_, { decoded }) => Effect.log(`Order: ${decoded.title}`),
})

function OrderPage() {
  return (
    <OrderForm.Initialize defaultValues={{ title: "", items: [] }}>
      <OrderForm.title />
      <OrderForm.items>
        {({ items, append, remove, swap, move }) => (
          <>
            {items.map((_, index) => (
              <OrderForm.items.Item key={index} index={index}>
                {({ remove }) => (
                  <div>
                    <OrderForm.items.name />
                    <button type="button" onClick={remove}>
                      Remove
                    </button>
                  </div>
                )}
              </OrderForm.items.Item>
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
      </OrderForm.items>
    </OrderForm.Initialize>
  )
}
```

## 3. Validation Modes

```tsx
FormReact.build(form, { runtime, fields, mode: "onSubmit", onSubmit })
FormReact.build(form, { runtime, fields, mode: "onBlur", onSubmit })
FormReact.build(form, { runtime, fields, mode: "onChange", onSubmit })
```

## 4. Cross-Field Validation (Sync Refinements)

```tsx
const signupForm = FormBuilder.empty
  .addField("password", Schema.String)
  .addField("confirmPassword", Schema.String)
  .refine((values) => {
    if (values.password !== values.confirmPassword) {
      return { path: ["confirmPassword"], message: "Passwords must match" }
    }
  })
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

const SignupForm = FormReact.build(signupFormBuilder, {
  runtime,
  fields: { username: UsernameInput },
  onSubmit: (_, { decoded }) => Effect.log(`Signup: ${decoded.username}`),
})
```

## 7. setValue and setValues

Operations are AtomResultFns - use `useAtomSet` to call them:

```tsx
function FormControls() {
  const setEmail = useAtomSet(LoginForm.setValue(LoginForm.fields.email))
  const setPassword = useAtomSet(LoginForm.setValue(LoginForm.fields.password))
  const setAllValues = useAtomSet(LoginForm.setValues)

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
FormReact.build(form, {
  runtime,
  fields,
  mode: { onChange: { debounce: "300 millis", autoSubmit: true } },
  onSubmit,
})

FormReact.build(form, {
  runtime,
  fields,
  mode: { onBlur: { autoSubmit: true } },
  onSubmit,
})
```

## 9. Debounced Validation

```tsx
FormReact.build(form, {
  runtime,
  fields,
  mode: { onChange: { debounce: "300 millis" } },
  onSubmit,
})
```

## 10. isDirty Tracking

```tsx
function FormStatus() {
  const isDirty = useAtomValue(LoginForm.isDirty)
  const reset = useAtomSet(LoginForm.reset)

  return (
    <>
      {isDirty && <span>You have unsaved changes</span>}
      <button onClick={() => reset()} disabled={!isDirty}>
        Reset
      </button>
    </>
  )
}

const EmailInput: React.FC<
  FormReact.FieldComponentProps<typeof Schema.String>
> = ({ field }) => (
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
  const hasChangedSinceSubmit = useAtomValue(LoginForm.hasChangedSinceSubmit)
  const lastSubmittedValues = useAtomValue(LoginForm.lastSubmittedValues)
  const revertToLastSubmit = useAtomSet(LoginForm.revertToLastSubmit)

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
  const isDirty = useAtomValue(LoginForm.isDirty)
  const submitCount = useAtomValue(LoginForm.submitCount)
  const submitResult = useAtomValue(LoginForm.submit)

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
    LoginForm.isDirty,
    (isDirty) => {
      console.log("Dirty state changed:", isDirty)
    },
    { immediate: false },
  )

  return null
}
```

## 13. Subscribing to Individual Field Values

Use `getFieldAtom` to subscribe to a specific field's value without re-rendering when other fields change:

```tsx
function EmailDisplay() {
  // Only re-renders when email changes, not when password changes
  const emailAtom = LoginForm.getFieldAtom(LoginForm.fields.email)
  const email = useAtomValue(emailAtom)

  return <span>Current email: {email}</span>
}

// Useful for derived state based on a single field
function PasswordStrength() {
  const passwordAtom = LoginForm.getFieldAtom(LoginForm.fields.password)
  const password = useAtomValue(passwordAtom)

  const strength = password.length < 8 ? "weak" : password.length < 12 ? "medium" : "strong"
  return <span>Password strength: {strength}</span>
}
```

## 14. Error Display Patterns

```tsx
const TextInput: React.FC<
  FormReact.FieldComponentProps<typeof Schema.String>
> = ({ field }) => (
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
  const submitResult = useAtomValue(LoginForm.submit)

  if (submitResult.waiting) return <span>Submitting...</span>
  if (Result.isSuccess(submitResult)) return <span>Success!</span>
  if (Result.isFailure(submitResult)) return <span>Failed</span>
  return null
}

// For side effects after submit (navigation, close dialog, etc.):
function FormWithSideEffects({ onClose }: { onClose: () => void }) {
  useAtomSubscribe(
    LoginForm.submit,
    (result) => {
      if (Result.isSuccess(result)) {
        onClose()
      }
    },
    { immediate: false },
  )

  return <LoginForm.Initialize defaultValues={{ email: "", password: "" }}>...</LoginForm.Initialize>
}
```

## 15. Custom Submit Arguments

Pass custom arguments to `onSubmit` by annotating the first parameter:

```tsx
// Define form with custom submit args
const ContactForm = FormReact.build(formBuilder, {
  runtime,
  fields: { email: TextInput, message: TextInput },
  onSubmit: (args: { source: string }, { decoded, encoded, get }) =>
    Effect.log(`Contact from ${args.source}: ${decoded.email}`),
})

// Pass args when submitting
function SubmitButton({ source }: { source: string }) {
  const submit = useAtomSet(ContactForm.submit)
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

## Available Atoms

All forms expose these atoms for fine-grained subscriptions:

```ts
form.values                  // Atom<Option<EncodedValues>> - current form values
form.isDirty                 // Atom<boolean> - values differ from initial
form.hasChangedSinceSubmit   // Atom<boolean> - values differ from last submit
form.lastSubmittedValues     // Atom<Option<SubmittedValues>> - last submitted values
form.submitCount             // Atom<number> - number of submit attempts
form.submit                  // AtomResultFn<SubmitArgs, A, E | ParseError> - submit with .waiting, ._tag
form.getFieldAtom(fieldRef)  // Atom<FieldValue> - subscribe to individual field values
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
interface FieldState<S extends Schema.Schema.Any> {
  value: Schema.Schema.Encoded<S> // Current field value
  onChange: (value: Schema.Schema.Encoded<S>) => void
  onBlur: () => void
  error: Option.Option<string> // Validation error (shown after touch/submit)
  isTouched: boolean // Field has been blurred
  isValidating: boolean // Async validation in progress
  isDirty: boolean // Value differs from initial
}

interface FieldComponentProps<
  S extends Schema.Schema.Any,
  P extends Record<string, unknown> = Record<string, never>
> {
  field: FieldState<S> // Form-controlled state
  props: P // Custom props passed at render time
}
```

### Defining Field Components with `forField`

Use `FormReact.forField()` for ergonomic component definition with full type inference:

```tsx
// Basic field component - schema type inferred from field definition
const EmailField = Field.makeField("email", Schema.String)
const TextInput = FormReact.forField(EmailField)(({ field }) => (
  <input
    value={field.value}
    onChange={(e) => field.onChange(e.target.value)}
    onBlur={field.onBlur}
  />
))

// With custom props - just specify the props type
const TextInput = FormReact.forField(EmailField)<{ placeholder?: string }>(({ field, props }) => (
  <input
    value={field.value}
    onChange={(e) => field.onChange(e.target.value)}
    placeholder={props.placeholder}
  />
))

// Pass props at render time
<LoginForm.email placeholder="Enter email" />
```

## License

MIT
