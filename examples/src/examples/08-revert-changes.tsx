import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import { Field, FormBuilder, FormReact } from "@lucas-barake/effect-form-react"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import styles from "../styles/form.module.css"

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
  <div className={styles.fieldContainer}>
    <label className={styles.label}>Name</label>
    <input
      type="text"
      value={field.value}
      onChange={(e) =>
        field.onChange(e.target.value)}
      onBlur={field.onBlur}
      className={`${styles.input} ${Option.isSome(field.error) ? styles.error : ""}`}
    />
    {Option.isSome(field.error) && <span className={styles.errorText}>{field.error.value}</span>}
  </div>
)

const EmailInput: React.FC<FormReact.FieldComponentProps<typeof EmailField.schema>> = ({ field }) => (
  <div className={styles.fieldContainer}>
    <label className={styles.label}>Email</label>
    <input
      type="text"
      value={field.value}
      onChange={(e) =>
        field.onChange(e.target.value)}
      onBlur={field.onBlur}
      className={`${styles.input} ${Option.isSome(field.error) ? styles.error : ""}`}
    />
    {Option.isSome(field.error) && <span className={styles.errorText}>{field.error.value}</span>}
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
    <div className={styles.unsavedBanner}>
      <span>You have unsaved changes</span>
      <button
        type="button"
        onClick={() => revertToLastSubmit()}
        className={styles.buttonWarning}
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
      className={styles.button}
    >
      {submitResult.waiting ? "Saving..." : "Save Profile"}
    </button>
  )
}

function FormActions() {
  const isDirty = useAtomValue(profileForm.isDirty)
  const reset = useAtomSet(profileForm.reset)

  return (
    <div className={styles.inlineFlex}>
      <SubmitButton />
      <button
        type="button"
        onClick={() => reset()}
        disabled={!isDirty}
        className={styles.buttonSecondary}
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
      <div className={styles.alertInfo}>
        Saving...
      </div>
    ))
    .onSuccess((value) => (
      <div className={`${styles.alertSuccess} ${styles.alertSmall} ${styles.marginTop16}`}>
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
    <div className={styles.debugBox}>
      <strong>Form State:</strong>
      <div className={`${styles.grid2Col} ${styles.gridGap16}`} style={{ marginTop: 12 }}>
        <div>
          <div className={styles.stateLabel}>Current Values:</div>
          <pre className={styles.statePre}>
            {JSON.stringify(Option.isSome(values) ? values.value : null, null, 2)}
          </pre>
        </div>
        <div>
          <div className={styles.stateLabel}>Last Submitted:</div>
          <pre className={styles.statePre}>
            {JSON.stringify(Option.isSome(lastSubmittedValues) ? lastSubmittedValues.value : null, null, 2)}
          </pre>
        </div>
      </div>
      <div className={styles.stateFlags}>
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
    <div className={styles.pageContainerMedium}>
      <h1 className={styles.pageTitle}>Revert Changes</h1>
      <p className={styles.pageDescription}>
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
