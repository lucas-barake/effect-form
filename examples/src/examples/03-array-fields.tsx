import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Field, FormBuilder, FormReact } from "@lucas-barake/effect-form-react"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import styles from "../styles/form.module.css"

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
          className={`${styles.listItemInput} ${Option.isSome(field.error) ? styles.error : ""}`}
        />
      ),
      completed: ({ field }) => (
        <input
          type="checkbox"
          checked={field.value}
          onChange={(e) => field.onChange(e.target.checked)}
          className={styles.checkbox}
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
      className={styles.button}
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
          {items.length === 0 && <p className={styles.emptyState}>No todos yet. Add one below!</p>}

          {items.map((_, index) => (
            <todoForm.todos.Item key={index} index={index}>
              {({ remove: removeItem }) => (
                <div className={styles.listItem}>
                  <todoForm.todos.completed />
                  <todoForm.todos.text />
                  <button
                    type="button"
                    onClick={removeItem}
                    className={`${styles.buttonDanger} ${styles.buttonSmall}`}
                  >
                    Remove
                  </button>
                </div>
              )}
            </todoForm.todos.Item>
          ))}

          <div className={`${styles.buttonGroup} ${styles.marginTop16}`}>
            <button
              type="button"
              onClick={() => append({ text: "", completed: false })}
              className={styles.buttonSuccess}
            >
              Add Todo
            </button>

            {items.length >= 2 && (
              <>
                <button
                  type="button"
                  onClick={() => swap(0, 1)}
                  className={styles.buttonIndigo}
                >
                  Swap 0 ↔ 1
                </button>
                <button
                  type="button"
                  onClick={() => move(0, items.length - 1)}
                  className={styles.buttonPurple}
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
    <div className={styles.debugBox}>
      <strong>Form Values:</strong>
      <pre className={styles.debugPre}>
        {JSON.stringify(Option.isSome(values) ? values.value : null, null, 2)}
      </pre>
    </div>
  )
}

export function ArrayFields() {
  const submit = useAtomSet(todoForm.submit)

  return (
    <div className={styles.pageContainerMedium}>
      <h1 className={styles.pageTitle}>Array Fields</h1>
      <p className={styles.pageDescription}>
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
          <div className={styles.marginTop24}>
            <SubmitButton />
          </div>
          <FormState />
        </form>
      </todoForm.Initialize>
    </div>
  )
}
