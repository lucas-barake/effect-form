import { useAtomSet, useAtomValue } from "@effectify/solid-effect-atom"
import * as Atom from "@effect-atom/atom/Atom"
import { Field, FormBuilder, FormSolid } from "@lucas-barake/effect-form-solid"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { Show } from "solid-js"
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
    })
})

const runtime = Atom.runtime(UsernameValidatorLive)

const UsernameField = Field.makeField(
  "username",
  Schema.String.pipe(
    Schema.minLength(3, { message: () => "Username must be at least 3 characters" }),
    Schema.pattern(/^[a-zA-Z0-9_]+$/, { message: () => "Only letters, numbers, and underscores" })
  )
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

const UsernameInput: FormSolid.FieldComponent<string> = (props) => (
  <div class={styles.fieldContainer}>
    <label class={styles.label}>Username</label>
    <input
      type="text"
      value={props.field.value}
      onInput={(e) => props.field.onChange(e.currentTarget.value)}
      onBlur={props.field.onBlur}
      class={`${styles.input} ${Option.isSome(props.field.error) ? styles.error : ""}`}
    />
    <Show when={props.field.isValidating}><span class={styles.validatingText}>Checking availability...</span></Show>
    <Show when={Option.isSome(props.field.error)}><span class={styles.errorText}>{Option.getOrElse(props.field.error, () => "")}</span></Show>
  </div>
)

const usernameForm = FormSolid.make(usernameFormBuilder, {
  runtime,
  mode: { validation: "onChange", debounce: "300 millis" },
  fields: { username: UsernameInput },
  onSubmit: (_, { decoded }) =>
    Effect.gen(function*() {
      yield* Effect.sleep("500 millis")
      yield* Effect.log(`Username registered: ${decoded.username}`)
      return { username: decoded.username }
    })
})

function SubmitButton() {
  const isDirty = useAtomValue(usernameForm.isDirty)
  const submitResult = useAtomValue(usernameForm.submit)

  return (
    <button
      type="submit"
      disabled={!isDirty() || submitResult().waiting}
      class={styles.button}
    >
      {submitResult().waiting ? "Registering..." : "Register"}
    </button>
  )
}

export function AsyncValidation() {
  const submit = useAtomSet(usernameForm.submit)

  return (
    <div class={styles.pageContainer}>
      <h1 class={styles.pageTitle}>Async Validation</h1>
      <p class={styles.pageDescription}>
        Using <code>.refineEffect()</code> with Effect services. Validation runs asynchronously with debouncing.
      </p>
      <p class={styles.pageHint}>
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
