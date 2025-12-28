# @lucas-barake/effect-form

Type-safe forms powered by Effect Schema.

## Installation

```bash
pnpm add @lucas-barake/effect-form-react
```

## 1. Basic Form Setup

```tsx
import { Field, Form } from "@lucas-barake/effect-form"
import { FormReact } from "@lucas-barake/effect-form-react"
import * as Atom from "@effect-atom/atom/Atom"
import * as Schema from "effect/Schema"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Layer from "effect/Layer"

const runtime = Atom.runtime(Layer.empty)

const EmailField = Field.makeField(
  "email",
  Schema.String.pipe(Schema.nonEmptyString()),
)
const PasswordField = Field.makeField(
  "password",
  Schema.String.pipe(Schema.minLength(8)),
)

const loginFormBuilder = Form.empty.addField(EmailField).addField(PasswordField)

const LoginForm = FormReact.build(loginFormBuilder, {
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

const handleSubmit = LoginForm.submit((values) =>
  Effect.log(`Login: ${values.email}`),
)

function LoginPage() {
  return (
    <LoginForm.Form
      defaultValues={{ email: "", password: "" }}
      onSubmit={handleSubmit}
    >
      <LoginForm.email />
      <LoginForm.password />
      <LoginForm.Subscribe>
        {({ submit, isDirty }) => (
          <button onClick={submit} disabled={!isDirty}>
            Login
          </button>
        )}
      </LoginForm.Subscribe>
    </LoginForm.Form>
  )
}
```

## 2. Array Fields

```tsx
const TitleField = Field.makeField("title", Schema.String)
const ItemsArrayField = Field.makeArrayField(
  "items",
  Schema.Struct({ name: Schema.String }),
)

const orderFormBuilder = Form.empty.addField(TitleField).addField(ItemsArrayField)

const OrderForm = FormReact.build(orderFormBuilder, {
  runtime,
  fields: {
    title: TitleInput,
    items: { name: ItemNameInput },
  },
})

function OrderPage() {
  return (
    <OrderForm.Form defaultValues={{ title: "", items: [] }} onSubmit={handleSubmit}>
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
    </OrderForm.Form>
  )
}
```

## 3. Validation Modes

```tsx
FormReact.build(form, { runtime, fields, mode: "onSubmit" })
FormReact.build(form, { runtime, fields, mode: "onBlur" })
FormReact.build(form, { runtime, fields, mode: "onChange" })
```

## 4. Cross-Field Validation (Sync Refinements)

```tsx
const PasswordField = Field.makeField("password", Schema.String)
const ConfirmPasswordField = Field.makeField("confirmPassword", Schema.String)

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
const UsernameField = Field.makeField("username", Schema.String)

const usernameForm = Form.empty
  .addField(UsernameField)
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

const UsernameField = Field.makeField("username", Schema.String)

const signupFormBuilder = Form.empty
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

const SignupForm = FormReact.build(signupFormBuilder, {
  runtime,
  fields: { username: UsernameInput },
})
```

## 7. setValue and setValues

```tsx
function FormControls() {
  const { setValue, setValues } = LoginForm.useForm()

  return (
    <>
      <button onClick={() => setValue(LoginForm.fields.email, "new@email.com")}>
        Set Email
      </button>

      <button
        onClick={() =>
          setValue(LoginForm.fields.password, (prev) => prev.toUpperCase())
        }
      >
        Uppercase Password
      </button>

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
FormReact.build(form, {
  runtime,
  fields,
  mode: { onChange: { debounce: "300 millis", autoSubmit: true } },
})

FormReact.build(form, {
  runtime,
  fields,
  mode: { onBlur: { autoSubmit: true } },
})
```

## 9. Debounced Validation

```tsx
FormReact.build(form, {
  runtime,
  fields,
  mode: { onChange: { debounce: "300 millis" } },
})
```

## 10. isDirty Tracking

```tsx
function FormStatus() {
  const { isDirty, reset } = LoginForm.useForm()

  return (
    <>
      {isDirty && <span>You have unsaved changes</span>}
      <button onClick={reset} disabled={!isDirty}>
        Reset
      </button>
    </>
  )
}

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

## 11. Track Changes Since Submit

Track whether form values differ from the last submitted state. Useful for "revert to last submit" functionality and "unsaved changes since submit" indicators.

```tsx
function FormStatus() {
  const { hasChangedSinceSubmit, lastSubmittedValues, revertToLastSubmit } =
    LoginForm.useForm()

  return (
    <>
      {hasChangedSinceSubmit && (
        <div>
          <span>You have unsaved changes since last submit</span>
          <button onClick={revertToLastSubmit}>Revert to Last Submit</button>
        </div>
      )}
      {Option.isSome(lastSubmittedValues) && (
        <span>Last submitted: {lastSubmittedValues.value.email}</span>
      )}
    </>
  )
}
```

The same properties are available in the Subscribe component:

```tsx
<LoginForm.Subscribe>
  {({ hasChangedSinceSubmit, revertToLastSubmit }) => (
    <button onClick={revertToLastSubmit} disabled={!hasChangedSinceSubmit}>
      Revert Changes
    </button>
  )}
</LoginForm.Subscribe>
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

```tsx
import { useAtomSubscribe } from "@effect-atom/atom-react"

function FormSideEffects() {
  useAtomSubscribe(
    LoginForm.atom,
    (state) => {
      if (Option.isSome(state)) {
        console.log("Form values changed:", state.value.values)
      }
    },
    { immediate: false },
  )

  return null
}
```

## 13. Error Display Patterns

```tsx
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

import * as Result from "@effect-atom/atom/Result"

function SubmitStatus() {
  const { submitResult } = LoginForm.useForm()

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
