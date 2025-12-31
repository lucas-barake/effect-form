import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Field, FormBuilder, FormReact } from "@lucas-barake/effect-form-react"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import styles from "../styles/form.module.css"

const UsernameField = Field.makeField(
  "username",
  Schema.String.pipe(Schema.minLength(3, { message: () => "Username must be at least 3 characters" })),
)

const formBuilder = FormBuilder.empty.addField(UsernameField)

const UsernameInput: React.FC<FormReact.FieldComponentProps<typeof UsernameField.schema>> = ({ field }) => (
  <div className={styles.fieldContainer}>
    <label className={styles.label}>Username</label>
    <input
      type="text"
      value={field.value}
      onChange={(e) =>
        field.onChange(e.target.value)}
      onBlur={field.onBlur}
      className={`${styles.input} ${Option.isSome(field.error) ? styles.error : ""}`}
    />
    {field.isValidating && <span className={styles.validatingText}>Validating...</span>}
    {Option.isSome(field.error) && <span className={styles.errorText}>{field.error.value}</span>}
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
    <div className={`${styles.card} ${styles.marginBottom16}`}>
      <h3 className={styles.cardTitle}>{title}</h3>
      <p className={styles.cardDescription}>{description}</p>
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
            className={`${styles.button} ${styles.buttonSmall}`}
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
    <div className={styles.pageContainerMedium}>
      <h1 className={styles.pageTitle}>Validation Modes</h1>
      <p className={styles.pageDescription}>
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
