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

const loginForm = FormReact.make(loginFormBuilder, {
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
FormReact.make(formBuilder, { runtime, fields, mode: "onSubmit", onSubmit })
FormReact.make(formBuilder, { runtime, fields, mode: "onBlur", onSubmit })
FormReact.make(formBuilder, { runtime, fields, mode: "onChange", onSubmit })
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
  runtime,
  fields,
  mode: { onChange: { debounce: "300 millis", autoSubmit: true } },
  onSubmit,
})

FormReact.make(formBuilder, {
  runtime,
  fields,
  mode: { onBlur: { autoSubmit: true } },
  onSubmit,
})
```

## 9. Debounced Validation

```tsx
FormReact.make(formBuilder, {
  runtime,
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

## 17. Bundled Field + Component

Use `FormReact.makeField` to bundle a field definition with its component in one place:

```tsx
import { FormBuilder, FormReact } from "@lucas-barake/effect-form-react"
import * as Schema from "effect/Schema"

// Define field + component together (curried API)
const NameInput = FormReact.makeField({
  key: "name",
  schema: Schema.String.pipe(Schema.nonEmptyString()),
})(({ field }) => (
  <input
    value={field.value}
    onChange={(e) => field.onChange(e.target.value)}
    onBlur={field.onBlur}
  />
))

// With extra props - specify only the props type
const EmailInput = FormReact.makeField({
  key: "email",
  schema: Schema.String,
})<{ placeholder: string }>(({ field, props }) => (
  <input
    value={field.value}
    onChange={(e) => field.onChange(e.target.value)}
    placeholder={props.placeholder}
  />
))

// Use .field for form builder
const formBuilder = FormBuilder.empty.addField(NameInput.field)

// Use the bundle directly in make()
const form = FormReact.make(formBuilder, {
  runtime,
  fields: { name: NameInput },
  onSubmit: (_, { decoded }) => Effect.log(decoded.name),
})
```

This reduces boilerplate when you need reusable field + component combos across multiple forms:

```tsx
// fields/name-input.tsx
export const NameInput = FormReact.makeField({
  key: "name",
  schema: Schema.String.pipe(Schema.nonEmptyString()),
})(({ field }) => <TextInput field={field} />)

// forms/user-form.tsx
import { NameInput } from "../fields/name-input"

const userFormBuilder = FormBuilder.empty.addField(NameInput.field).addField("email", Schema.String)
const userForm = FormReact.make(userFormBuilder, {
  runtime,
  fields: { name: NameInput, email: EmailComponent },
  onSubmit: ...,
})

// forms/profile-form.tsx
import { NameInput } from "../fields/name-input"

const profileFormBuilder = FormBuilder.empty.addField(NameInput.field).addField("bio", Schema.String)
const profileForm = FormReact.make(profileFormBuilder, {
  runtime,
  fields: { name: NameInput, bio: BioComponent },
  onSubmit: ...,
})
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
form.getFieldAtom(fieldRef)  // Atom<Option<FieldValue>> - subscribe to individual field values (None before init)
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

Use `FormReact.forField()` with reusable `FieldDef`s for ergonomic component definition with full type inference:

```tsx
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
