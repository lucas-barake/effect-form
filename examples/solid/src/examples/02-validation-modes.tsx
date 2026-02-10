import { useAtomSet, useAtomValue } from "@effectify/solid-effect-atom"
import { Field, FormBuilder, FormSolid } from "@lucas-barake/effect-form-solid"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { Show } from "solid-js"
import styles from "../styles/form.module.css"

const UsernameField = Field.makeField(
  "username",
  Schema.String.pipe(Schema.minLength(3, { message: () => "Username must be at least 3 characters" }))
)

const formBuilder = FormBuilder.empty.addField(UsernameField)

const UsernameInput: FormSolid.FieldComponent<string> = (props) => (
  <div class={styles.fieldContainer}>
    <label class={styles.label}>Username</label>
    <input
      type="text"
      value={props.field.value}
      onInput={(e) => props.field.onChange(e.currentTarget.value)}
      onBlur={props.field.onBlur}
      class={`${styles.input} ${Option.isSome(props.field.error) ? styles.error : ""}`}
    />
    <Show when={props.field.isValidating}><span class={styles.validatingText}>Validating...</span></Show>
    <Show when={Option.isSome(props.field.error)}><span class={styles.errorText}>{Option.getOrElse(props.field.error, () => "")}</span></Show>
  </div>
)

const onSubmitForm = FormSolid.make(formBuilder, {
  mode: { validation: "onSubmit" },
  fields: { username: UsernameInput },
  onSubmit: () => Effect.log("Submitted (onSubmit mode)")
})

const onBlurForm = FormSolid.make(formBuilder, {
  mode: { validation: "onBlur" },
  fields: { username: UsernameInput },
  onSubmit: () => Effect.log("Submitted (onBlur mode)")
})

const onChangeForm = FormSolid.make(formBuilder, {
  mode: { validation: "onChange" },
  fields: { username: UsernameInput },
  onSubmit: () => Effect.log("Submitted (onChange mode)")
})

const debouncedForm = FormSolid.make(formBuilder, {
  mode: { validation: "onChange", debounce: "300 millis" },
  fields: { username: UsernameInput },
  onSubmit: () => Effect.log("Submitted (debounced mode)")
})

function FormCard(props: {
  title: string
  description: string
  form: typeof onSubmitForm
}) {
  const isDirty = useAtomValue(props.form.isDirty)
  const submitResult = useAtomValue(props.form.submit)
  const submit = useAtomSet(props.form.submit)

  return (
    <div class={`${styles.card} ${styles.marginBottom16}`}>
      <h3 class={styles.cardTitle}>{props.title}</h3>
      <p class={styles.cardDescription}>{props.description}</p>
      <props.form.Initialize defaultValues={{ username: "" }}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <props.form.username />
          <button
            type="submit"
            disabled={!isDirty() || submitResult().waiting}
            class={`${styles.button} ${styles.buttonSmall}`}
          >
            Submit
          </button>
        </form>
      </props.form.Initialize>
    </div>
  )
}

export function ValidationModes() {
  return (
    <div class={styles.pageContainerMedium}>
      <h1 class={styles.pageTitle}>Validation Modes</h1>
      <p class={styles.pageDescription}>
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
