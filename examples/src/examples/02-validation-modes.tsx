import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Field, FormBuilder, FormReact } from "@lucas-barake/effect-form-react"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

const UsernameField = Field.makeField(
  "username",
  Schema.String.pipe(Schema.minLength(3, { message: () => "Username must be at least 3 characters" })),
)

const formBuilder = FormBuilder.empty.addField(UsernameField)

const UsernameInput: React.FC<FormReact.FieldComponentProps<typeof UsernameField.schema>> = ({ field }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Username</label>
    <input
      type="text"
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
      <span style={{ color: "#666", fontSize: 12, marginTop: 4, display: "block" }}>Validating...</span>
    )}
    {Option.isSome(field.error) && (
      <span style={{ color: "#dc2626", fontSize: 12, marginTop: 4, display: "block" }}>{field.error.value}</span>
    )}
  </div>
)

const onSubmitForm = FormReact.make(formBuilder, {
  mode: "onSubmit",
  fields: { username: UsernameInput },
  onSubmit: () => Effect.log("Submitted (onSubmit mode)"),
})

const onBlurForm = FormReact.make(formBuilder, {
  mode: "onBlur",
  fields: { username: UsernameInput },
  onSubmit: () => Effect.log("Submitted (onBlur mode)"),
})

const onChangeForm = FormReact.make(formBuilder, {
  mode: "onChange",
  fields: { username: UsernameInput },
  onSubmit: () => Effect.log("Submitted (onChange mode)"),
})

const debouncedForm = FormReact.make(formBuilder, {
  mode: { onChange: { debounce: "300 millis" } },
  fields: { username: UsernameInput },
  onSubmit: () => Effect.log("Submitted (debounced mode)"),
})

function FormCard({
  description,
  form,
  title,
}: {
  title: string
  description: string
  form: typeof onSubmitForm
}) {
  const isDirty = useAtomValue(form.isDirty)
  const submitResult = useAtomValue(form.submit)
  const submit = useAtomSet(form.submit)

  return (
    <div style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 16 }}>
      <h3 style={{ margin: "0 0 4px" }}>{title}</h3>
      <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 16px" }}>{description}</p>
      <form.Initialize defaultValues={{ username: "" }}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <form.username />
          <button
            type="submit"
            disabled={!isDirty || submitResult.waiting}
            style={{
              padding: "8px 16px",
              backgroundColor: !isDirty || submitResult.waiting ? "#ccc" : "#2563eb",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: !isDirty || submitResult.waiting ? "not-allowed" : "pointer",
            }}
          >
            Submit
          </button>
        </form>
      </form.Initialize>
    </div>
  )
}

export function ValidationModes() {
  return (
    <div style={{ maxWidth: 500 }}>
      <h1 style={{ marginTop: 0, marginBottom: 8 }}>Validation Modes</h1>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>
        Different validation timing strategies. Type less than 3 characters to see errors.
      </p>

      <FormCard
        title="onSubmit"
        description="Errors show only after clicking Submit"
        form={onSubmitForm}
      />

      <FormCard
        title="onBlur"
        description="Errors show after leaving the field (blur)"
        form={onBlurForm}
      />

      <FormCard
        title="onChange"
        description="Errors show immediately on every keystroke"
        form={onChangeForm}
      />

      <FormCard
        title="Debounced (300ms)"
        description="Errors show 300ms after you stop typing"
        form={debouncedForm}
      />
    </div>
  )
}
