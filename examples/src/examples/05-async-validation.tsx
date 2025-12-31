import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import * as Atom from "@effect-atom/atom/Atom"
import { Field, FormBuilder, FormReact } from "@lucas-barake/effect-form-react"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

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
      <span style={{ color: "#666", fontSize: 12, marginTop: 4, display: "block" }}>Checking availability...</span>
    )}
    {Option.isSome(field.error) && (
      <span style={{ color: "#dc2626", fontSize: 12, marginTop: 4, display: "block" }}>{field.error.value}</span>
    )}
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
      style={{
        padding: "10px 20px",
        backgroundColor: !isDirty || submitResult.waiting ? "#ccc" : "#2563eb",
        color: "white",
        border: "none",
        borderRadius: 4,
        cursor: !isDirty || submitResult.waiting ? "not-allowed" : "pointer",
      }}
    >
      {submitResult.waiting ? "Registering..." : "Register"}
    </button>
  )
}

export function AsyncValidation() {
  const submit = useAtomSet(usernameForm.submit)

  return (
    <div style={{ maxWidth: 400 }}>
      <h1 style={{ marginTop: 0, marginBottom: 8 }}>Async Validation</h1>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>
        Using <code>.refineEffect()</code> with Effect services. Validation runs asynchronously with debouncing.
      </p>
      <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 24 }}>
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
