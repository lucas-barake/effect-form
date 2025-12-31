import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Field, FormBuilder, FormReact } from "@lucas-barake/effect-form-react"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

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
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Password</label>
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
      <span style={{ color: "#dc2626", fontSize: 12, marginTop: 4, display: "block" }}>{field.error.value}</span>
    )}
  </div>
)

const ConfirmPasswordInput: React.FC<FormReact.FieldComponentProps<typeof ConfirmPasswordField.schema>> = ({
  field,
}) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Confirm Password</label>
    <input
      type="password"
      value={field.value}
      onChange={(e) => field.onChange(e.target.value)}
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
      <span style={{ color: "#dc2626", fontSize: 12, marginTop: 4, display: "block" }}>{field.error.value}</span>
    )}
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
      style={{
        padding: "10px 20px",
        backgroundColor: !isDirty || submitResult.waiting ? "#ccc" : "#2563eb",
        color: "white",
        border: "none",
        borderRadius: 4,
        cursor: !isDirty || submitResult.waiting ? "not-allowed" : "pointer",
      }}
    >
      {submitResult.waiting ? "Setting Password..." : "Set Password"}
    </button>
  )
}

export function CrossFieldValidation() {
  const submit = useAtomSet(signupForm.submit)

  return (
    <div style={{ maxWidth: 400 }}>
      <h1 style={{ marginTop: 0, marginBottom: 8 }}>Cross-Field Validation</h1>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>
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
