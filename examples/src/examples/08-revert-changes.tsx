import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import { Field, FormBuilder, FormReact } from "@lucas-barake/effect-form-react"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

const NameField = Field.makeField(
  "name",
  Schema.String.pipe(Schema.nonEmptyString({ message: () => "Name is required" })),
)

const EmailField = Field.makeField(
  "email",
  Schema.String.pipe(Schema.nonEmptyString({ message: () => "Email is required" })),
)

const profileFormBuilder = FormBuilder.empty.addField(NameField).addField(EmailField)

const NameInput: React.FC<FormReact.FieldComponentProps<typeof NameField.schema>> = ({ field }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Name</label>
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
    {Option.isSome(field.error) && (
      <span style={{ color: "#dc2626", fontSize: 12, marginTop: 4, display: "block" }}>{field.error.value}</span>
    )}
  </div>
)

const EmailInput: React.FC<FormReact.FieldComponentProps<typeof EmailField.schema>> = ({ field }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Email</label>
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
    {Option.isSome(field.error) && (
      <span style={{ color: "#dc2626", fontSize: 12, marginTop: 4, display: "block" }}>{field.error.value}</span>
    )}
  </div>
)

const profileForm = FormReact.make(profileFormBuilder, {
  mode: "onBlur",
  fields: {
    name: NameInput,
    email: EmailInput,
  },
  onSubmit: (_, { decoded }) =>
    Effect.gen(function*() {
      yield* Effect.sleep("500 millis")
      yield* Effect.log(`Profile updated: ${decoded.name}`)
      return { savedAt: new Date() }
    }),
})

function UnsavedChangesBanner() {
  const hasChangedSinceSubmit = useAtomValue(profileForm.hasChangedSinceSubmit)
  const revertToLastSubmit = useAtomSet(profileForm.revertToLastSubmit)

  if (!hasChangedSinceSubmit) return null

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 12,
        backgroundColor: "#fef3c7",
        borderRadius: 4,
        marginBottom: 16,
      }}
    >
      <span>You have unsaved changes</span>
      <button
        type="button"
        onClick={() => revertToLastSubmit()}
        style={{
          padding: "6px 12px",
          backgroundColor: "#f59e0b",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          fontSize: 13,
        }}
      >
        Revert Changes
      </button>
    </div>
  )
}

function SubmitButton() {
  const isDirty = useAtomValue(profileForm.isDirty)
  const submitResult = useAtomValue(profileForm.submit)

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
      {submitResult.waiting ? "Saving..." : "Save Profile"}
    </button>
  )
}

function FormActions() {
  const isDirty = useAtomValue(profileForm.isDirty)
  const reset = useAtomSet(profileForm.reset)

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <SubmitButton />
      <button
        type="button"
        onClick={() => reset()}
        disabled={!isDirty}
        style={{
          padding: "10px 20px",
          backgroundColor: isDirty ? "#6b7280" : "#ccc",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: isDirty ? "pointer" : "not-allowed",
        }}
      >
        Reset to Initial
      </button>
    </div>
  )
}

function SaveStatus() {
  const submitResult = useAtomValue(profileForm.submit)

  return Result.builder(submitResult)
    .onWaiting(() => (
      <div style={{ padding: 8, backgroundColor: "#dbeafe", borderRadius: 4, fontSize: 13, marginTop: 16 }}>
        Saving...
      </div>
    ))
    .onSuccess((value) => (
      <div style={{ padding: 8, backgroundColor: "#dcfce7", borderRadius: 4, fontSize: 13, marginTop: 16 }}>
        Last saved at {value.savedAt.toLocaleTimeString()}
      </div>
    ))
    .orNull()
}

function StateComparison() {
  const values = useAtomValue(profileForm.values)
  const lastSubmittedValues = useAtomValue(profileForm.lastSubmittedValues)
  const isDirty = useAtomValue(profileForm.isDirty)
  const hasChangedSinceSubmit = useAtomValue(profileForm.hasChangedSinceSubmit)
  const submitCount = useAtomValue(profileForm.submitCount)

  return (
    <div style={{ marginTop: 24, padding: 16, backgroundColor: "#f3f4f6", borderRadius: 4, fontSize: 12 }}>
      <strong>Form State:</strong>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Current Values:</div>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(Option.isSome(values) ? values.value : null, null, 2)}
          </pre>
        </div>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Last Submitted:</div>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(Option.isSome(lastSubmittedValues) ? lastSubmittedValues.value : null, null, 2)}
          </pre>
        </div>
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 16 }}>
        <span>
          isDirty: <strong>{String(isDirty)}</strong>
        </span>
        <span>
          hasChangedSinceSubmit: <strong>{String(hasChangedSinceSubmit)}</strong>
        </span>
        <span>
          submitCount: <strong>{submitCount}</strong>
        </span>
      </div>
    </div>
  )
}

export function RevertChanges() {
  const submit = useAtomSet(profileForm.submit)

  return (
    <div style={{ maxWidth: 500 }}>
      <h1 style={{ marginTop: 0, marginBottom: 8 }}>Revert Changes</h1>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>
        Track changes since last submit with <code>hasChangedSinceSubmit</code> and{" "}
        <code>revertToLastSubmit</code>. Shows "unsaved changes" banner when form differs from last submitted state.
      </p>

      <profileForm.Initialize defaultValues={{ name: "John Doe", email: "john@example.com" }}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <UnsavedChangesBanner />
          <profileForm.name />
          <profileForm.email />
          <FormActions />
          <SaveStatus />
          <StateComparison />
        </form>
      </profileForm.Initialize>
    </div>
  )
}
