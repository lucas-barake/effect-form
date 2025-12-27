# @lucas-barake/effect-form

Type-safe forms powered by Effect Schema.

## Installation

```bash
pnpm add @lucas-barake/effect-form-react
```

## 1. Basic Form Setup

```tsx
import { Form } from "@lucas-barake/effect-form"
import { FormReact } from "@lucas-barake/effect-form-react"
import * as Atom from "@effect-atom/atom/Atom"
import * as Schema from "effect/Schema"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Layer from "effect/Layer"

// Create runtime
const runtime = Atom.runtime(Layer.empty)

// Define fields as named constants
const EmailField = Form.makeField(
  "email",
  Schema.String.pipe(Schema.nonEmptyString()),
)
const PasswordField = Form.makeField(
  "password",
  Schema.String.pipe(Schema.minLength(8)),
)

// Define form by adding fields
const loginForm = Form.empty.addField(EmailField).addField(PasswordField)

// Build React form
const form = FormReact.build(loginForm, {
  runtime,
  fields: {
    email: ({ value, onChange, onBlur, error }) => (
      <div>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
        {Option.isSome(error) && <span className="error">{error.value}</span>}
      </div>
    ),
    password: ({ value, onChange, onBlur, error }) => (
      <div>
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
        {Option.isSome(error) && <span className="error">{error.value}</span>}
      </div>
    ),
  },
})

// Create submit handler
const handleSubmit = form.submit((values) =>
  Effect.log(`Login: ${values.email}`),
)

function LoginPage() {
  return (
    <form.Form
      defaultValues={{ email: "", password: "" }}
      onSubmit={handleSubmit}
    >
      <form.email />
      <form.password />
      <form.Subscribe>
        {({ submit, isDirty }) => (
          <button onClick={submit} disabled={!isDirty}>
            Login
          </button>
        )}
      </form.Subscribe>
    </form.Form>
  )
}
```

## 2. Array Fields

```tsx
// Define fields for order form
const TitleField = Form.makeField("title", Schema.String)
const ItemsArrayField = Form.makeArrayField(
  "items",
  Schema.Struct({ name: Schema.String }),
)

// Build order form
const orderForm = Form.empty.addField(TitleField).addField(ItemsArrayField)

const form = FormReact.build(orderForm, {
  runtime,
  fields: {
    title: TitleInput,
    items: { name: ItemNameInput },
  },
})

function OrderPage() {
  return (
    <form.Form defaultValues={{ title: "", items: [] }} onSubmit={handleSubmit}>
      <form.title />
      <form.items>
        {({ items, append, remove, swap, move }) => (
          <>
            {items.map((_, index) => (
              <form.items.Item key={index} index={index}>
                {({ remove }) => (
                  <div>
                    <form.items.name />
                    <button type="button" onClick={remove}>
                      Remove
                    </button>
                  </div>
                )}
              </form.items.Item>
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
      </form.items>
    </form.Form>
  )
}
```

## 3. Validation Modes

```tsx
// Default: validate on submit only
FormReact.build(form, { runtime, fields, mode: "onSubmit" })

// Validate on blur
FormReact.build(form, { runtime, fields, mode: "onBlur" })

// Validate on change (immediate)
FormReact.build(form, { runtime, fields, mode: "onChange" })
```

## 4. Cross-Field Validation (Sync Refinements)

```tsx
// Define fields
const PasswordField = Form.makeField("password", Schema.String)
const ConfirmPasswordField = Form.makeField("confirmPassword", Schema.String)

// Build form with cross-field validation
const signupForm = Form.empty
  .addField(PasswordField)
  .addField(ConfirmPasswordField)
  .refine((values) => {
    if (values.password !== values.confirmPassword) {
      return { path: ["confirmPassword"], message: "Passwords must match" }
    }
  })
```

## 5. Async Refinements

```tsx
// Define field
const UsernameField = Form.makeField("username", Schema.String)

// Build form with async validation
const usernameForm = Form.empty
  .addField(UsernameField)
  .refineEffect((values) =>
    Effect.gen(function* () {
      yield* Effect.sleep("100 millis") // Simulate API call
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

// Define a service for validation
class UsernameValidator extends Context.Tag("UsernameValidator")<
  UsernameValidator,
  { readonly isTaken: (username: string) => Effect.Effect<boolean> }
>() {}

// Create service implementation
const UsernameValidatorLive = Layer.succeed(UsernameValidator, {
  isTaken: (username) =>
    Effect.gen(function* () {
      yield* Effect.sleep("100 millis") // Simulate API call
      return username === "taken"
    }),
})

// Create runtime with the service layer
const runtime = Atom.runtime(UsernameValidatorLive)

// Define form with async validation using the service
const UsernameField = Form.makeField("username", Schema.String)

const signupForm = Form.empty
  .addField(UsernameField)
  .refineEffect((values) =>
    Effect.gen(function* () {
      const validator = yield* UsernameValidator
      const isTaken = yield* validator.isTaken(values.username)
      if (isTaken) {
        return { path: ["username"], message: "Username is already taken" }
      }
    }),
  )

// Build form - the runtime provides the service
const form = FormReact.build(signupForm, {
  runtime,
  fields: { username: UsernameInput },
})
```

## 7. setValue and setValues

```tsx
function FormControls() {
  const { setValue, setValues } = form.useForm()

  return (
    <>
      {/* Update single field */}
      <button onClick={() => setValue(form.fields.email, "new@email.com")}>
        Set Email
      </button>

      {/* Update with callback */}
      <button
        onClick={() =>
          setValue(form.fields.count, (prev) => String(Number(prev) + 1))
        }
      >
        Increment
      </button>

      {/* Filter array items */}
      <button
        onClick={() =>
          setValue(form.fields.items, (items) =>
            items.filter((i) => i.name !== ""),
          )
        }
      >
        Remove Empty
      </button>

      {/* Replace all values */}
      <button
        onClick={() => setValues({ email: "reset@email.com", password: "" })}
      >
        Reset to Defaults
      </button>
    </>
  )
}
```

## 8. Auto-Submit Mode

```tsx
// Auto-submit on change (debounced)
FormReact.build(form, {
  runtime,
  fields,
  mode: { onChange: { debounce: "300 millis", autoSubmit: true } },
})

// Auto-submit on blur
FormReact.build(form, {
  runtime,
  fields,
  mode: { onBlur: { autoSubmit: true } },
})
```

## 9. Debounced Validation

```tsx
// Debounce validation without auto-submit
FormReact.build(form, {
  runtime,
  fields,
  mode: { onChange: { debounce: "300 millis" } },
})
```

## 10. isDirty Tracking

```tsx
function FormStatus() {
  const { isDirty, reset } = form.useForm()

  return (
    <>
      {isDirty && <span>You have unsaved changes</span>}
      <button onClick={reset} disabled={!isDirty}>
        Reset
      </button>
    </>
  )
}

// Per-field isDirty
const EmailInput: React.FC<
  FormReact.FieldComponentProps<typeof Schema.String>
> = ({ value, onChange, onBlur, isDirty }) => (
  <div>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
    />
    {isDirty && <span>*</span>}
  </div>
)
```

## 11. Error Display Patterns

```tsx
// Field component with all error-related props
const TextInput: React.FC<
  FormReact.FieldComponentProps<typeof Schema.String>
> = ({ value, onChange, onBlur, error, isTouched, isValidating }) => (
  <div>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
    />
    {isValidating && <span>Validating...</span>}
    {Option.isSome(error) && <span className="error">{error.value}</span>}
  </div>
)

// Submit result handling
import * as Result from "@effect-atom/atom/Result"

function SubmitStatus() {
  const { submitResult } = form.useForm()

  if (submitResult.waiting) return <span>Submitting...</span>
  if (Result.isSuccess(submitResult)) return <span>Success!</span>
  if (Result.isFailure(submitResult)) return <span>Failed</span>
  return null
}
```

## Field Component Props Reference

```ts
interface FieldComponentProps<S extends Schema.Schema.Any> {
  value: Schema.Schema.Encoded<S> // Current field value
  onChange: (value: Schema.Schema.Encoded<S>) => void
  onBlur: () => void
  error: Option.Option<string> // Validation error (shown after touch/submit)
  isTouched: boolean // Field has been blurred
  isValidating: boolean // Async validation in progress
  isDirty: boolean // Value differs from initial
}
```

## License

MIT
