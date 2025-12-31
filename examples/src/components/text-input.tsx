import type { FormReact } from "@lucas-barake/effect-form-react"
import * as Option from "effect/Option"
import type * as Schema from "effect/Schema"

export const TextInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({ field }) => (
  <div style={{ marginBottom: 16 }}>
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
      <span style={{ color: "#666", fontSize: 12, marginTop: 4, display: "block" }}>
        Validating...
      </span>
    )}
    {Option.isSome(field.error) && (
      <span style={{ color: "#dc2626", fontSize: 12, marginTop: 4, display: "block" }}>
        {field.error.value}
      </span>
    )}
  </div>
)
