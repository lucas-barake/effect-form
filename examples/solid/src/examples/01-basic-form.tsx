import { useAtomSet, useAtomValue } from "@effectify/solid-effect-atom"
import * as Result from "@effect-atom/atom/Result"
import { Field, FormBuilder, FormSolid } from "@lucas-barake/effect-form-solid"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { Show } from "solid-js"
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
  Schema.String.pipe(Schema.nonEmptyString({ message: () => "Email is required" }))
)

const PasswordField = Field.makeField(
  "password",
  Schema.String.pipe(Schema.minLength(8, { message: () => "Password must be at least 8 characters" }))
)

const loginFormBuilder = FormBuilder.empty
  .addField(EmailField)
  .addField(PasswordField)

const EmailInput: FormSolid.FieldComponent<string> = (props) => (
  <div class={styles.fieldContainer}>
    <label class={styles.label}>
      Email
      <Show when={props.field.isDirty}><span class={styles.dirtyIndicator}>*</span></Show>
    </label>
    <input
      type="email"
      value={props.field.value}
      onInput={(e) => props.field.onChange(e.currentTarget.value)}
      onBlur={props.field.onBlur}
      class={`${styles.input} ${Option.isSome(props.field.error) ? styles.error : ""}`}
    />
    <Show when={props.field.isValidating}>
      <span class={styles.validatingText}>
        Validating...
      </span>
    </Show>
    <Show when={Option.isSome(props.field.error)}>
      <span class={styles.errorText}>
        {Option.getOrElse(props.field.error, () => "")}
      </span>
    </Show>
  </div>
)

const PasswordInput: FormSolid.FieldComponent<string> = (props) => (
  <div class={styles.fieldContainer}>
    <label class={styles.label}>
      Password
      <Show when={props.field.isDirty}><span class={styles.dirtyIndicator}>*</span></Show>
    </label>
    <input
      type="password"
      value={props.field.value}
      onInput={(e) => props.field.onChange(e.currentTarget.value)}
      onBlur={props.field.onBlur}
      class={`${styles.input} ${Option.isSome(props.field.error) ? styles.error : ""}`}
    />
    <Show when={Option.isSome(props.field.error)}>
      <span class={styles.errorText}>
        {Option.getOrElse(props.field.error, () => "")}
      </span>
    </Show>
  </div>
)

const loginForm = FormSolid.make(loginFormBuilder, {
  fields: {
    email: EmailInput,
    password: PasswordInput
  },
  onSubmit: (_, { decoded }) =>
    Effect.gen(function*() {
      yield* Effect.sleep("500 millis")

      if (decoded.email === "locked@example.com") {
        return yield* new AccountLockedError({
          email: decoded.email,
          unlockAt: new Date(Date.now() + 1000 * 60 * 30)
        })
      }

      if (decoded.email === "invalid@example.com") {
        return yield* new InvalidCredentialsError({ email: decoded.email })
      }

      yield* Effect.log(`Login successful: ${decoded.email}`)
      return { email: decoded.email }
    })
})

function SubmitButton() {
  const isDirty = useAtomValue(loginForm.isDirty)
  const submitResult = useAtomValue(loginForm.submit)

  return (
    <button
      type="submit"
      disabled={!isDirty() || submitResult().waiting}
      class={styles.button}
    >
      {submitResult().waiting ? "Logging in..." : "Login"}
    </button>
  )
}

function SubmitStatus() {
  const submitResult = useAtomValue(loginForm.submit)

  return (
    <>
        {Result.builder(submitResult())
        .onWaiting(() => null)
        .onSuccess((value) => (
        <div class={styles.alertSuccess}>
            Login successful! Welcome, {value.email}
        </div>
        ))
        .onErrorTag(
        "InvalidCredentialsError",
        (error) => (
            <div class={styles.alertError}>
            Invalid credentials for {error.email}. Please check your email and password.
            </div>
        )
        )
        .onErrorTag(
        "AccountLockedError",
        (error) => (
            <div class={styles.alertWarning}>
            Account {error.email} is locked. Try again at {error.unlockAt.toLocaleTimeString()}.
            </div>
        )
        )
        .onErrorTag(
        "ParseError",
        () => (
            <div class={styles.alertError}>
            Please fix the validation errors above.
            </div>
        )
        )
        .onDefect((defect) => (
        <div class={styles.alertError}>
            Unexpected error: {String(defect)}
        </div>
        ))
        .orNull()}
    </>
  )
}

function FormDebug() {
  const isDirty = useAtomValue(loginForm.isDirty)
  const submitCount = useAtomValue(loginForm.submitCount)
  const values = useAtomValue(loginForm.values)

  return (
    <div class={styles.debugBox}>
      <strong>Form State:</strong>
      <pre class={styles.debugPre}>
        {JSON.stringify(
          {
            isDirty: isDirty(),
            submitCount: submitCount(),
            values: Option.getOrNull(values()),
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
    <div class={styles.pageContainer}>
      <h1 class={styles.pageTitle}>Basic Form</h1>
      <p class={styles.pageDescription}>
        Simple login form with type-safe error handling using <code>Data.TaggedError</code> and{" "}
        <code>Result.builder()</code>.
      </p>
      <p class={styles.pageHint}>
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
