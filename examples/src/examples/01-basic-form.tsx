import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import { Field, FormBuilder, FormReact } from "@lucas-barake/effect-form-react"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

class InvalidCredentialsError extends Data.TaggedError("InvalidCredentialsError")<{
  readonly email: string
}> {}

class AccountLockedError extends Data.TaggedError("AccountLockedError")<{
  readonly email: string
  readonly unlockAt: Date
}> {}

const EmailField = Field.makeField(
  "email",
  Schema.String.pipe(Schema.nonEmptyString({ message: () => "Email is required" })),
)

const PasswordField = Field.makeField(
  "password",
  Schema.String.pipe(Schema.minLength(8, { message: () => "Password must be at least 8 characters" })),
)

const loginFormBuilder = FormBuilder.empty
  .addField(EmailField)
  .addField(PasswordField)

const EmailInput: React.FC<FormReact.FieldComponentProps<typeof EmailField.schema>> = ({ field }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
      Email
      {field.isDirty && <span style={{ color: "#666", marginLeft: 4 }}>*</span>}
    </label>
    <input
      type="email"
      value={field.value}
      onChange={(e) =>
        field.onChange(e.target.value)}
      onBlur={field.onBlur}
      style={{
        padding: "8px 12px",
        border: Option.isSome(field.error) ? "1px solid #dc2626" : "1px solid #ccc",
        borderRadius: 4,
        width: "100%",
        boxSizing: "border-box",
      }}
    />
    {field.isValidating && (
      <span style={{ color: "#666", fontSize: 12, marginTop: 4, display: "block" }}>
        Validating...
      </span>
    )}
    {Option.isSome(field.error) && (
      <span style={{ color: "#dc2626", fontSize: 12, marginTop: 4, display: "block" }}>
        {field.error.value}
      </span>
    )}
  </div>
)

const PasswordInput: React.FC<FormReact.FieldComponentProps<typeof PasswordField.schema>> = ({ field }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>
      Password
      {field.isDirty && <span style={{ color: "#666", marginLeft: 4 }}>*</span>}
    </label>
    <input
      type="password"
      value={field.value}
      onChange={(e) =>
        field.onChange(e.target.value)}
      onBlur={field.onBlur}
      style={{
        padding: "8px 12px",
        border: Option.isSome(field.error) ? "1px solid #dc2626" : "1px solid #ccc",
        borderRadius: 4,
        width: "100%",
        boxSizing: "border-box",
      }}
    />
    {Option.isSome(field.error) && (
      <span style={{ color: "#dc2626", fontSize: 12, marginTop: 4, display: "block" }}>
        {field.error.value}
      </span>
    )}
  </div>
)

const loginForm = FormReact.make(loginFormBuilder, {
  fields: {
    email: EmailInput,
    password: PasswordInput,
  },
  onSubmit: (_, { decoded }) =>
    Effect.gen(function*() {
      yield* Effect.sleep("500 millis")

      if (decoded.email === "locked@example.com") {
        return yield* new AccountLockedError({
          email: decoded.email,
          unlockAt: new Date(Date.now() + 1000 * 60 * 30),
        })
      }

      if (decoded.email === "invalid@example.com") {
        return yield* new InvalidCredentialsError({ email: decoded.email })
      }

      yield* Effect.log(`Login successful: ${decoded.email}`)
      return { email: decoded.email }
    }),
})

function SubmitButton() {
  const isDirty = useAtomValue(loginForm.isDirty)
  const submitResult = useAtomValue(loginForm.submit)

  return (
    <button
      type="submit"
      disabled={!isDirty || submitResult.waiting}
      style={{
        padding: "10px 20px",
        backgroundColor: !isDirty || submitResult.waiting ? "#ccc" : "#2563eb",
        color: "white",
        border: "none",
        borderRadius: 4,
        cursor: !isDirty || submitResult.waiting ? "not-allowed" : "pointer",
        fontWeight: 500,
      }}
    >
      {submitResult.waiting ? "Logging in..." : "Login"}
    </button>
  )
}

function SubmitStatus() {
  const submitResult = useAtomValue(loginForm.submit)

  return Result.builder(submitResult)
    .onWaiting(() => null)
    .onSuccess((value) => (
      <div style={{ padding: 12, backgroundColor: "#dcfce7", borderRadius: 4, marginTop: 16 }}>
        Login successful! Welcome, {value.email}
      </div>
    ))
    .onErrorTag(
      "InvalidCredentialsError",
      (error) => (
        <div style={{ padding: 12, backgroundColor: "#fee2e2", borderRadius: 4, marginTop: 16 }}>
          Invalid credentials for {error.email}. Please check your email and password.
        </div>
      ),
    )
    .onErrorTag(
      "AccountLockedError",
      (error) => (
        <div style={{ padding: 12, backgroundColor: "#fef3c7", borderRadius: 4, marginTop: 16 }}>
          Account {error.email} is locked. Try again at {error.unlockAt.toLocaleTimeString()}.
        </div>
      ),
    )
    .onErrorTag(
      "ParseError",
      () => (
        <div style={{ padding: 12, backgroundColor: "#fee2e2", borderRadius: 4, marginTop: 16 }}>
          Please fix the validation errors above.
        </div>
      ),
    )
    .onDefect((defect) => (
      <div style={{ padding: 12, backgroundColor: "#fee2e2", borderRadius: 4, marginTop: 16 }}>
        Unexpected error: {String(defect)}
      </div>
    ))
    .orNull()
}

function FormDebug() {
  const isDirty = useAtomValue(loginForm.isDirty)
  const submitCount = useAtomValue(loginForm.submitCount)
  const values = useAtomValue(loginForm.values)

  return (
    <div style={{ marginTop: 24, padding: 16, backgroundColor: "#f3f4f6", borderRadius: 4, fontSize: 12 }}>
      <strong>Form State:</strong>
      <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>
        {JSON.stringify(
          {
            isDirty,
            submitCount,
            values: Option.isSome(values) ? values.value : null,
          },
          null,
          2
        )}
      </pre>
    </div>
  )
}

export function BasicForm() {
  const submit = useAtomSet(loginForm.submit)

  return (
    <div style={{ maxWidth: 400 }}>
      <h1 style={{ marginTop: 0, marginBottom: 8 }}>Basic Form</h1>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>
        Simple login form with type-safe error handling using <code>Data.TaggedError</code> and{" "}
        <code>Result.builder()</code>.
      </p>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 24 }}>
        Try: <code>invalid@example.com</code> for credentials error, <code>locked@example.com</code> for account locked.
      </p>

      <loginForm.Initialize defaultValues={{ email: "", password: "" }}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <loginForm.email />
          <loginForm.password />
          <SubmitButton />
          <SubmitStatus />
          <FormDebug />
        </form>
      </loginForm.Initialize>
    </div>
  )
}
