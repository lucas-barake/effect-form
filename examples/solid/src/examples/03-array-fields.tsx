import { useAtomSet, useAtomValue } from "@effectify/solid-effect-atom"
import { Field, FormBuilder, FormSolid } from "@lucas-barake/effect-form-solid"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { For, Show } from "solid-js"
import styles from "../styles/form.module.css"

const TodosField = Field.makeArrayField(
  "todos",
  Schema.Struct({
    text: Schema.String.pipe(Schema.nonEmptyString({ message: () => "Todo text is required" })),
    completed: Schema.Boolean
  })
)

const todoFormBuilder = FormBuilder.empty.addField(TodosField)

const todoForm = FormSolid.make(todoFormBuilder, {
  fields: {
    todos: {
      text: (props) => (
        <input
          value={props.field.value}
          onInput={(e) => props.field.onChange(e.currentTarget.value)}
          onBlur={props.field.onBlur}
          placeholder="What needs to be done?"
          class={`${styles.listItemInput} ${Option.isSome(props.field.error) ? styles.error : ""}`}
        />
      ),
      completed: (props) => (
        <input
          type="checkbox"
          checked={props.field.value}
          onChange={(e) => props.field.onChange(e.currentTarget.checked)}
          class={styles.checkbox}
        />
      )
    }
  },
  onSubmit: (_, { decoded }) =>
    Effect.gen(function*() {
      yield* Effect.log(`Submitting ${decoded.todos.length} todos`)
      return { count: decoded.todos.length }
    })
})

function SubmitButton() {
  const isDirty = useAtomValue(todoForm.isDirty)
  const submitResult = useAtomValue(todoForm.submit)

  return (
    <button
      type="submit"
      disabled={!isDirty() || submitResult().waiting}
      class={styles.button}
    >
      {submitResult().waiting ? "Saving..." : "Save Todos"}
    </button>
  )
}

function TodoList() {
  return (
    <todoForm.todos>
      {(api) => (
        <div>
          <Show when={api.items().length === 0}><p class={styles.emptyState}>No todos yet. Add one below!</p></Show>

          <For each={api.items()}>
            {(_, index) => (
                <todoForm.todos.Item index={index()}>
                {(itemApi) => (
                    <div class={styles.listItem}>
                    <todoForm.todos.completed />
                    <todoForm.todos.text />
                    <button
                        type="button"
                        onClick={() => itemApi.remove()}
                        class={`${styles.buttonDanger} ${styles.buttonSmall}`}
                    >
                        Remove
                    </button>
                    </div>
                )}
                </todoForm.todos.Item>
            )}
          </For>

          <div class={`${styles.buttonGroup} ${styles.marginTop16}`}>
            <button
              type="button"
              onClick={() => api.append({ text: "", completed: false })}
              class={styles.buttonSuccess}
            >
              Add Todo
            </button>

            <Show when={api.items().length >= 2}>
              <>
                <button
                  type="button"
                  onClick={() => api.swap(0, 1)}
                  class={styles.buttonIndigo}
                >
                  Swap 0 ↔ 1
                </button>
                <button
                  type="button"
                  onClick={() => api.move(0, api.items().length - 1)}
                  class={styles.buttonPurple}
                >
                  Move first → last
                </button>
              </>
            </Show>
          </div>
        </div>
      )}
    </todoForm.todos>
  )
}

function FormState() {
  const values = useAtomValue(todoForm.values)

  return (
    <div class={styles.debugBox}>
      <strong>Form Values:</strong>
      <pre class={styles.debugPre}>
        {JSON.stringify(Option.getOrNull(values()), null, 2)}
      </pre>
    </div>
  )
}

export function ArrayFields() {
  const submit = useAtomSet(todoForm.submit)

  return (
    <div class={styles.pageContainerMedium}>
      <h1 class={styles.pageTitle}>Array Fields</h1>
      <p class={styles.pageDescription}>
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
          <div class={styles.marginTop24}>
            <SubmitButton />
          </div>
          <FormState />
        </form>
      </todoForm.Initialize>
    </div>
  )
}
