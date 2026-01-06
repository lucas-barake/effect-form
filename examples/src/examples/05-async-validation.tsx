import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import * as Atom from "@effect-atom/atom/Atom"
import { Field, FormBuilder, FormReact } from "@lucas-barake/effect-form-react"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import styles from "../styles/form.module.css"

class UsernameValidator extends Context.Tag("UsernameValidator")<
  UsernameValidator,
  { readonly isTaken: (username: string) => Effect.Effect<boolean> }
>() {}

const UsernameValidatorLive = Layer.succeed(UsernameValidator, {
  isTaken: (username) =>
    Effect.gen(function*() {
      yield* Effect.sleep("800 millis")
      const reserved = ["admin", "root", "taken"]
      return reserved.includes(username.toLowerCase())
    }),
})

const runtime = Atom.runtime(UsernameValidatorLive)

const UsernameField = Field.makeField(
  "username",
  Schema.String.pipe(
    Schema.minLength(3, { message: () => "Username must be at least 3 characters" }),
    Schema.pattern(/^[a-zA-Z0-9_]+$/, { message: () => "Only letters, numbers, and underscores" }),
  ),
)

const usernameFormBuilder = FormBuilder.empty
  .addField(UsernameField)
  .refineEffect((values) =>
    Effect.gen(function*() {
      const validator = yield* UsernameValidator
      const isTaken = yield* validator.isTaken(values.username)
      if (isTaken) {
        return { path: ["username"], message: "This username is already taken" }
      }
    })
  )

const UsernameInput: FormReact.FieldComponent<string> = ({ field }) => (
  <div className={styles.fieldContainer}>
    <label className={styles.label}>Username</label>
    <input
      type="text"
      value={field.value}
      onChange={(e) =>
        field.onChange(e.target.value)}
      onBlur={field.onBlur}
      className={`${styles.input} ${Option.isSome(field.error) ? styles.error : ""}`}
    />
    {field.isValidating && <span className={styles.validatingText}>Checking availability...</span>}
    {Option.isSome(field.error) && <span className={styles.errorText}>{field.error.value}</span>}
  </div>
)

const usernameForm = FormReact.make(usernameFormBuilder, {
  runtime,
  mode: { onChange: { debounce: "300 millis" } },
  fields: { username: UsernameInput },
  onSubmit: (_, { decoded }) =>
    Effect.gen(function*() {
      yield* Effect.sleep("500 millis")
      yield* Effect.log(`Username registered: ${decoded.username}`)
      return { username: decoded.username }
    }),
})

function SubmitButton() {
  const isDirty = useAtomValue(usernameForm.isDirty)
  const submitResult = useAtomValue(usernameForm.submit)

  return (
    <button
      type="submit"
      disabled={!isDirty || submitResult.waiting}
      className={styles.button}
    >
      {submitResult.waiting ? "Registering..." : "Register"}
    </button>
  )
}

export function AsyncValidation() {
  const submit = useAtomSet(usernameForm.submit)

  return (
    <div className={styles.pageContainer}>
      <h1 className={styles.pageTitle}>Async Validation</h1>
      <p className={styles.pageDescription}>
        Using <code>.refineEffect()</code> with Effect services. Validation runs asynchronously with debouncing.
      </p>
      <p className={styles.pageHint}>
        Reserved usernames: <code>admin</code>, <code>root</code>, <code>taken</code>
      </p>

      <usernameForm.Initialize defaultValues={{ username: "" }}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <usernameForm.username />
          <SubmitButton />
        </form>
      </usernameForm.Initialize>
    </div>
  )
}
