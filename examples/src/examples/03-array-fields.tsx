import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Field, FormBuilder, FormReact } from "@lucas-barake/effect-form-react"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

const TodosField = Field.makeArrayField(
  "todos",
  Schema.Struct({
    text: Schema.String.pipe(Schema.nonEmptyString({ message: () => "Todo text is required" })),
    completed: Schema.Boolean,
  }),
)

const todoFormBuilder = FormBuilder.empty.addField(TodosField)

const todoForm = FormReact.make(todoFormBuilder, {
  fields: {
    todos: {
      text: ({ field }) => (
        <input
          value={field.value}
          onChange={(e) => field.onChange(e.target.value)}
          onBlur={field.onBlur}
          placeholder="What needs to be done?"
          style={{
            flex: 1,
            padding: "8px 12px",
            border: Option.isSome(field.error) ? "1px solid #dc2626" : "1px solid #ccc",
            borderRadius: 4,
          }}
        />
      ),
      completed: ({ field }) => (
        <input
          type="checkbox"
          checked={field.value}
          onChange={(e) => field.onChange(e.target.checked)}
          style={{ width: 20, height: 20 }}
        />
      ),
    },
  },
  onSubmit: (_, { decoded }) =>
    Effect.gen(function*() {
      yield* Effect.log(`Submitting ${decoded.todos.length} todos`)
      return { count: decoded.todos.length }
    }),
})

function SubmitButton() {
  const isDirty = useAtomValue(todoForm.isDirty)
  const submitResult = useAtomValue(todoForm.submit)

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
      {submitResult.waiting ? "Saving..." : "Save Todos"}
    </button>
  )
}

function TodoList() {
  return (
    <todoForm.todos>
      {({ append, items, move, swap }) => (
        <div>
          {items.length === 0 && <p style={{ color: "#6b7280", fontStyle: "italic" }}>No todos yet. Add one below!</p>}

          {items.map((_, index) => (
            <todoForm.todos.Item key={index} index={index}>
              {({ remove: removeItem }) => (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    marginBottom: 8,
                    padding: 8,
                    backgroundColor: "#f9fafb",
                    borderRadius: 4,
                  }}
                >
                  <todoForm.todos.completed />
                  <todoForm.todos.text />
                  <button
                    type="button"
                    onClick={removeItem}
                    style={{
                      padding: "4px 8px",
                      backgroundColor: "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </todoForm.todos.Item>
          ))}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button
              type="button"
              onClick={() => append({ text: "", completed: false })}
              style={{
                padding: "8px 16px",
                backgroundColor: "#10b981",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              Add Todo
            </button>

            {items.length >= 2 && (
              <>
                <button
                  type="button"
                  onClick={() => swap(0, 1)}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#6366f1",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  Swap 0 ↔ 1
                </button>
                <button
                  type="button"
                  onClick={() => move(0, items.length - 1)}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#8b5cf6",
                    color: "white",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  Move first → last
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </todoForm.todos>
  )
}

function FormState() {
  const values = useAtomValue(todoForm.values)

  return (
    <div style={{ marginTop: 24, padding: 16, backgroundColor: "#f3f4f6", borderRadius: 4, fontSize: 12 }}>
      <strong>Form Values:</strong>
      <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>
        {JSON.stringify(Option.isSome(values) ? values.value : null, null, 2)}
      </pre>
    </div>
  )
}

export function ArrayFields() {
  const submit = useAtomSet(todoForm.submit)

  return (
    <div style={{ maxWidth: 500 }}>
      <h1 style={{ marginTop: 0, marginBottom: 8 }}>Array Fields</h1>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>
        Dynamic list with <code>append</code>, <code>remove</code>, <code>swap</code>, and <code>move</code> operations.
      </p>

      <todoForm.Initialize defaultValues={{ todos: [] }}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <TodoList />
          <div style={{ marginTop: 24 }}>
            <SubmitButton />
          </div>
          <FormState />
        </form>
      </todoForm.Initialize>
    </div>
  )
}
