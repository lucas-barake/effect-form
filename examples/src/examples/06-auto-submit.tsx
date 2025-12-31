import { useAtomValue } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import { Field, FormBuilder, FormReact } from "@lucas-barake/effect-form-react"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

const DisplayNameField = Field.makeField(
  "displayName",
  Schema.String.pipe(Schema.nonEmptyString({ message: () => "Display name is required" })),
)

const BioField = Field.makeField("bio", Schema.String)

const settingsFormBuilder = FormBuilder.empty.addField(DisplayNameField).addField(BioField)

const DisplayNameInput: React.FC<FormReact.FieldComponentProps<typeof DisplayNameField.schema>> = ({ field }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Display Name</label>
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

const BioInput: React.FC<FormReact.FieldComponentProps<typeof BioField.schema>> = ({ field }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Bio</label>
    <input
      type="text"
      value={field.value}
      onChange={(e) =>
        field.onChange(e.target.value)}
      onBlur={field.onBlur}
      style={{
        padding: "8px 12px",
        border: "1px solid #ccc",
        borderRadius: 4,
        width: "100%",
        boxSizing: "border-box",
      }}
    />
  </div>
)

const autoSubmitOnChangeForm = FormReact.make(settingsFormBuilder, {
  mode: { onChange: { debounce: "500 millis", autoSubmit: true } },
  fields: {
    displayName: DisplayNameInput,
    bio: BioInput,
  },
  onSubmit: (_, { decoded }) =>
    Effect.gen(function*() {
      yield* Effect.sleep("300 millis")
      yield* Effect.log(`Auto-saved: ${decoded.displayName}`)
      return { savedAt: new Date() }
    }),
})

const autoSubmitOnBlurForm = FormReact.make(settingsFormBuilder, {
  mode: { onBlur: { autoSubmit: true } },
  fields: {
    displayName: DisplayNameInput,
    bio: BioInput,
  },
  onSubmit: (_, { decoded }) =>
    Effect.gen(function*() {
      yield* Effect.sleep("300 millis")
      yield* Effect.log(`Auto-saved on blur: ${decoded.displayName}`)
      return { savedAt: new Date() }
    }),
})

function SaveStatus({ form }: { form: typeof autoSubmitOnChangeForm }) {
  const submitResult = useAtomValue(form.submit)

  return Result.builder(submitResult)
    .onWaiting(() => (
      <div style={{ padding: 8, backgroundColor: "#fef3c7", borderRadius: 4, fontSize: 13 }}>
        Saving...
      </div>
    ))
    .onSuccess((value) => (
      <div style={{ padding: 8, backgroundColor: "#dcfce7", borderRadius: 4, fontSize: 13 }}>
        Saved at {value.savedAt.toLocaleTimeString()}
      </div>
    ))
    .onError(() => (
      <div style={{ padding: 8, backgroundColor: "#fee2e2", borderRadius: 4, fontSize: 13 }}>
        Failed to save
      </div>
    ))
    .orNull()
}

export function AutoSubmit() {
  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ marginTop: 0, marginBottom: 8 }}>Auto-Submit</h1>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>
        Forms that automatically save when you make changes. No submit button needed!
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        <div style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <h3 style={{ margin: "0 0 4px" }}>Auto-save on Change</h3>
          <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 16px" }}>
            Saves 500ms after you stop typing
          </p>
          <autoSubmitOnChangeForm.Initialize defaultValues={{ displayName: "John", bio: "Hello!" }}>
            <autoSubmitOnChangeForm.displayName />
            <autoSubmitOnChangeForm.bio />
            <SaveStatus form={autoSubmitOnChangeForm} />
          </autoSubmitOnChangeForm.Initialize>
        </div>

        <div style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <h3 style={{ margin: "0 0 4px" }}>Auto-save on Blur</h3>
          <p style={{ color: "#6b7280", fontSize: 14, margin: "0 0 16px" }}>
            Saves when you leave a field
          </p>
          <autoSubmitOnBlurForm.Initialize defaultValues={{ displayName: "Jane", bio: "Hi there!" }}>
            <autoSubmitOnBlurForm.displayName />
            <autoSubmitOnBlurForm.bio />
            <SaveStatus form={autoSubmitOnBlurForm} />
          </autoSubmitOnBlurForm.Initialize>
        </div>
      </div>
    </div>
  )
}
