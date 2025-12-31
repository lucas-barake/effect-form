import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Field, FormBuilder, FormReact } from "@lucas-barake/effect-form-react"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import styles from "../styles/form.module.css"

const PasswordField = Field.makeField(
  "password",
  Schema.String.pipe(Schema.minLength(8, { message: () => "Password must be at least 8 characters" })),
)

const ConfirmPasswordField = Field.makeField(
  "confirmPassword",
  Schema.String.pipe(Schema.nonEmptyString({ message: () => "Please confirm your password" })),
)

const signupFormBuilder = FormBuilder.empty
  .addField(PasswordField)
  .addField(ConfirmPasswordField)
  .refine((values) => {
    if (values.password !== values.confirmPassword) {
      return { path: ["confirmPassword"], message: "Passwords must match" }
    }
  })

const PasswordInput: React.FC<FormReact.FieldComponentProps<typeof PasswordField.schema>> = ({ field }) => (
  <div className={styles.fieldContainer}>
    <label className={styles.label}>Password</label>
    <input
      type="password"
      value={field.value}
      onChange={(e) =>
        field.onChange(e.target.value)}
      onBlur={field.onBlur}
      className={`${styles.input} ${Option.isSome(field.error) ? styles.error : ""}`}
    />
    {Option.isSome(field.error) && <span className={styles.errorText}>{field.error.value}</span>}
  </div>
)

const ConfirmPasswordInput: React.FC<FormReact.FieldComponentProps<typeof ConfirmPasswordField.schema>> = ({
  field,
}) => (
  <div className={styles.fieldContainer}>
    <label className={styles.label}>Confirm Password</label>
    <input
      type="password"
      value={field.value}
      onChange={(e) => field.onChange(e.target.value)}
      onBlur={field.onBlur}
      className={`${styles.input} ${Option.isSome(field.error) ? styles.error : ""}`}
    />
    {Option.isSome(field.error) && <span className={styles.errorText}>{field.error.value}</span>}
  </div>
)

const signupForm = FormReact.make(signupFormBuilder, {
  mode: "onBlur",
  fields: {
    password: PasswordInput,
    confirmPassword: ConfirmPasswordInput,
  },
  onSubmit: () =>
    Effect.gen(function*() {
      yield* Effect.sleep("500 millis")
      yield* Effect.log("Password set for signup")
      return { success: true }
    }),
})

function SubmitButton() {
  const isDirty = useAtomValue(signupForm.isDirty)
  const submitResult = useAtomValue(signupForm.submit)

  return (
    <button
      type="submit"
      disabled={!isDirty || submitResult.waiting}
      className={styles.button}
    >
      {submitResult.waiting ? "Setting Password..." : "Set Password"}
    </button>
  )
}

export function CrossFieldValidation() {
  const submit = useAtomSet(signupForm.submit)

  return (
    <div className={styles.pageContainer}>
      <h1 className={styles.pageTitle}>Cross-Field Validation</h1>
      <p className={styles.pageDescription}>
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
