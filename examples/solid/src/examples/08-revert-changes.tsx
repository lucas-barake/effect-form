import { useAtomSet, useAtomValue } from "@effectify/solid-effect-atom"
import * as Result from "@effect-atom/atom/Result"
import { Field, FormBuilder, FormSolid } from "@lucas-barake/effect-form-solid"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { Show } from "solid-js"
import styles from "../styles/form.module.css"

const NameField = Field.makeField(
  "name",
  Schema.String.pipe(Schema.nonEmptyString({ message: () => "Name is required" }))
)

const EmailField = Field.makeField(
  "email",
  Schema.String.pipe(Schema.nonEmptyString({ message: () => "Email is required" }))
)

const profileFormBuilder = FormBuilder.empty.addField(NameField).addField(EmailField)

const NameInput: FormSolid.FieldComponent<string> = (props) => (
  <div class={styles.fieldContainer}>
    <label class={styles.label}>Name</label>
    <input
      type="text"
      value={props.field.value}
      onInput={(e) => props.field.onChange(e.currentTarget.value)}
      onBlur={props.field.onBlur}
      class={`${styles.input} ${Option.isSome(props.field.error) ? styles.error : ""}`}
    />
    <Show when={Option.isSome(props.field.error)}><span class={styles.errorText}>{Option.getOrElse(props.field.error, () => "")}</span></Show>
  </div>
)

const EmailInput: FormSolid.FieldComponent<string> = (props) => (
  <div class={styles.fieldContainer}>
    <label class={styles.label}>Email</label>
    <input
      type="text"
      value={props.field.value}
      onInput={(e) => props.field.onChange(e.currentTarget.value)}
      onBlur={props.field.onBlur}
      class={`${styles.input} ${Option.isSome(props.field.error) ? styles.error : ""}`}
    />
    <Show when={Option.isSome(props.field.error)}><span class={styles.errorText}>{Option.getOrElse(props.field.error, () => "")}</span></Show>
  </div>
)

const profileForm = FormSolid.make(profileFormBuilder, {
  mode: { validation: "onBlur" },
  fields: {
    name: NameInput,
    email: EmailInput
  },
  onSubmit: (_, { decoded }) =>
    Effect.gen(function*() {
      yield* Effect.sleep("500 millis")
      yield* Effect.log(`Profile updated: ${decoded.name}`)
      return { savedAt: new Date() }
    })
})

function UnsavedChangesBanner() {
  const hasChangedSinceSubmit = useAtomValue(profileForm.hasChangedSinceSubmit)
  const revertToLastSubmit = useAtomSet(profileForm.revertToLastSubmit)

  return (
    <Show when={hasChangedSinceSubmit()}>
        <div class={styles.unsavedBanner}>
        <span>You have unsaved changes</span>
        <button
            type="button"
            onClick={() => revertToLastSubmit()}
            class={styles.buttonWarning}
        >
            Revert Changes
        </button>
        </div>
    </Show>
  )
}

function SubmitButton() {
  const isDirty = useAtomValue(profileForm.isDirty)
  const submitResult = useAtomValue(profileForm.submit)

  return (
    <button
      type="submit"
      disabled={!isDirty() || submitResult().waiting}
      class={styles.button}
    >
      {submitResult().waiting ? "Saving..." : "Save Profile"}
    </button>
  )
}

function FormActions() {
  const isDirty = useAtomValue(profileForm.isDirty)
  const reset = useAtomSet(profileForm.reset)

  return (
    <div class={styles.inlineFlex}>
      <SubmitButton />
      <button
        type="button"
        onClick={() => reset()}
        disabled={!isDirty()}
        class={styles.buttonSecondary}
      >
        Reset to Initial
      </button>
    </div>
  )
}

function SaveStatus() {
  const submitResult = useAtomValue(profileForm.submit)

  return (
    <>
        {Result.builder(submitResult())
        .onWaiting(() => (
        <div class={styles.alertInfo}>
            Saving...
        </div>
        ))
        .onSuccess((value) => (
        <div class={`${styles.alertSuccess} ${styles.alertSmall} ${styles.marginTop16}`}>
            Last saved at {value.savedAt.toLocaleTimeString()}
        </div>
        ))
        .orNull()}
    </>
  )
}

function StateComparison() {
  const values = useAtomValue(profileForm.values)
  const lastSubmittedValues = useAtomValue(profileForm.lastSubmittedValues)
  const isDirty = useAtomValue(profileForm.isDirty)
  const hasChangedSinceSubmit = useAtomValue(profileForm.hasChangedSinceSubmit)
  const submitCount = useAtomValue(profileForm.submitCount)

  return (
    <div class={styles.debugBox}>
      <strong>Form State:</strong>
      <div class={`${styles.grid2Col} ${styles.gridGap16}`} style={{ "margin-top": "12px" }}>
        <div>
          <div class={styles.stateLabel}>Current Values:</div>
          <pre class={styles.statePre}>
            {JSON.stringify(Option.getOrNull(values()), null, 2)}
          </pre>
        </div>
        <div>
          <div class={styles.stateLabel}>Last Submitted:</div>
          <pre class={styles.statePre}>
            {JSON.stringify(Option.getOrNull(lastSubmittedValues()), null, 2)}
          </pre>
        </div>
      </div>
      <div class={styles.stateFlags}>
        <span>
          isDirty: <strong>{String(isDirty())}</strong>
        </span>
        <span>
          hasChangedSinceSubmit: <strong>{String(hasChangedSinceSubmit())}</strong>
        </span>
        <span>
          submitCount: <strong>{submitCount()}</strong>
        </span>
      </div>
    </div>
  )
}

export function RevertChanges() {
  const submit = useAtomSet(profileForm.submit)

  return (
    <div class={styles.pageContainerMedium}>
      <h1 class={styles.pageTitle}>Revert Changes</h1>
      <p class={styles.pageDescription}>
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
