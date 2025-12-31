import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import { Field, FormBuilder, FormReact } from "@lucas-barake/effect-form-react"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import styles from "../styles/form.module.css"

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
  <div className={styles.fieldContainer}>
    <label className={styles.label}>
      Email
      {field.isDirty && <span className={styles.dirtyIndicator}>*</span>}
    </label>
    <input
      type="email"
      value={field.value}
      onChange={(e) =>
        field.onChange(e.target.value)}
      onBlur={field.onBlur}
      className={`${styles.input} ${Option.isSome(field.error) ? styles.error : ""}`}
    />
    {field.isValidating && (
      <span className={styles.validatingText}>
        Validating...
      </span>
    )}
    {Option.isSome(field.error) && (
      <span className={styles.errorText}>
        {field.error.value}
      </span>
    )}
  </div>
)

const PasswordInput: React.FC<FormReact.FieldComponentProps<typeof PasswordField.schema>> = ({ field }) => (
  <div className={styles.fieldContainer}>
    <label className={styles.label}>
      Password
      {field.isDirty && <span className={styles.dirtyIndicator}>*</span>}
    </label>
    <input
      type="password"
      value={field.value}
      onChange={(e) =>
        field.onChange(e.target.value)}
      onBlur={field.onBlur}
      className={`${styles.input} ${Option.isSome(field.error) ? styles.error : ""}`}
    />
    {Option.isSome(field.error) && (
      <span className={styles.errorText}>
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
      className={styles.button}
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
      <div className={styles.alertSuccess}>
        Login successful! Welcome, {value.email}
      </div>
    ))
    .onErrorTag(
      "InvalidCredentialsError",
      (error) => (
        <div className={styles.alertError}>
          Invalid credentials for {error.email}. Please check your email and password.
        </div>
      ),
    )
    .onErrorTag(
      "AccountLockedError",
      (error) => (
        <div className={styles.alertWarning}>
          Account {error.email} is locked. Try again at {error.unlockAt.toLocaleTimeString()}.
        </div>
      ),
    )
    .onErrorTag(
      "ParseError",
      () => (
        <div className={styles.alertError}>
          Please fix the validation errors above.
        </div>
      ),
    )
    .onDefect((defect) => (
      <div className={styles.alertError}>
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
    <div className={styles.debugBox}>
      <strong>Form State:</strong>
      <pre className={styles.debugPre}>
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
    <div className={styles.pageContainer}>
      <h1 className={styles.pageTitle}>Basic Form</h1>
      <p className={styles.pageDescription}>
        Simple login form with type-safe error handling using <code>Data.TaggedError</code> and{" "}
        <code>Result.builder()</code>.
      </p>
      <p className={styles.pageHint}>
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
