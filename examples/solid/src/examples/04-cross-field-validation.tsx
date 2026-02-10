import { useAtomSet, useAtomValue } from "@effectify/solid-effect-atom"
import { Field, FormBuilder, FormSolid } from "@lucas-barake/effect-form-solid"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { Show } from "solid-js"
import styles from "../styles/form.module.css"

const PasswordField = Field.makeField(
  "password",
  Schema.String.pipe(Schema.minLength(8, { message: () => "Password must be at least 8 characters" }))
)

const ConfirmPasswordField = Field.makeField(
  "confirmPassword",
  Schema.String.pipe(Schema.nonEmptyString({ message: () => "Please confirm your password" }))
)

const signupFormBuilder = FormBuilder.empty
  .addField(PasswordField)
  .addField(ConfirmPasswordField)
  .refine((values) => {
    if (values.password !== values.confirmPassword) {
      return { path: ["confirmPassword"], message: "Passwords must match" }
    }
  })

const PasswordInput: FormSolid.FieldComponent<string> = (props) => (
  <div class={styles.fieldContainer}>
    <label class={styles.label}>Password</label>
    <input
      type="password"
      value={props.field.value}
      onInput={(e) => props.field.onChange(e.currentTarget.value)}
      onBlur={props.field.onBlur}
      class={`${styles.input} ${Option.isSome(props.field.error) ? styles.error : ""}`}
    />
    <Show when={Option.isSome(props.field.error)}><span class={styles.errorText}>{Option.getOrElse(props.field.error, () => "")}</span></Show>
  </div>
)

const ConfirmPasswordInput: FormSolid.FieldComponent<string> = (props) => (
  <div class={styles.fieldContainer}>
    <label class={styles.label}>Confirm Password</label>
    <input
      type="password"
      value={props.field.value}
      onInput={(e) => props.field.onChange(e.currentTarget.value)}
      onBlur={props.field.onBlur}
      class={`${styles.input} ${Option.isSome(props.field.error) ? styles.error : ""}`}
    />
    <Show when={Option.isSome(props.field.error)}><span class={styles.errorText}>{Option.getOrElse(props.field.error, () => "")}</span></Show>
  </div>
)

const signupForm = FormSolid.make(signupFormBuilder, {
  mode: { validation: "onBlur" },
  fields: {
    password: PasswordInput,
    confirmPassword: ConfirmPasswordInput
  },
  onSubmit: () =>
    Effect.gen(function*() {
      yield* Effect.sleep("500 millis")
      yield* Effect.log("Password set for signup")
      return { success: true }
    })
})

function SubmitButton() {
  const isDirty = useAtomValue(signupForm.isDirty)
  const submitResult = useAtomValue(signupForm.submit)

  return (
    <button
      type="submit"
      disabled={!isDirty() || submitResult().waiting}
      class={styles.button}
    >
      {submitResult().waiting ? "Setting Password..." : "Set Password"}
    </button>
  )
}

export function CrossFieldValidation() {
  const submit = useAtomSet(signupForm.submit)

  return (
    <div class={styles.pageContainer}>
      <h1 class={styles.pageTitle}>Cross-Field Validation</h1>
      <p class={styles.pageDescription}>
        Using <code>.refine()</code> for synchronous cross-field validation. Error is routed to the{" "}
        <code>confirmPassword</code> field.
      </p>

      <signupForm.Initialize defaultValues={{ password: "", confirmPassword: "" }}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <signupForm.password />
          <signupForm.confirmPassword />
          <SubmitButton />
        </form>
      </signupForm.Initialize>
    </div>
  )
}
