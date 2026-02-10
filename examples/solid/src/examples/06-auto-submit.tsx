import { useAtomValue } from "@effectify/solid-effect-atom"
import * as Result from "@effect-atom/atom/Result"
import { Field, FormBuilder, FormSolid } from "@lucas-barake/effect-form-solid"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { Show } from "solid-js"
import styles from "../styles/form.module.css"

const DisplayNameField = Field.makeField(
  "displayName",
  Schema.String.pipe(Schema.nonEmptyString({ message: () => "Display name is required" }))
)

const BioField = Field.makeField("bio", Schema.String)

const settingsFormBuilder = FormBuilder.empty.addField(DisplayNameField).addField(BioField)

const DisplayNameInput: FormSolid.FieldComponent<string> = (props) => (
  <div class={styles.fieldContainer}>
    <label class={styles.label}>Display Name</label>
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

const BioInput: FormSolid.FieldComponent<string> = (props) => (
  <div class={styles.fieldContainer}>
    <label class={styles.label}>Bio</label>
    <input
      type="text"
      value={props.field.value}
      onInput={(e) => props.field.onChange(e.currentTarget.value)}
      onBlur={props.field.onBlur}
      class={styles.input}
    />
  </div>
)

const autoSubmitOnChangeForm = FormSolid.make(settingsFormBuilder, {
  mode: { validation: "onChange", debounce: "500 millis", autoSubmit: true },
  fields: {
    displayName: DisplayNameInput,
    bio: BioInput
  },
  onSubmit: (_, { decoded }) =>
    Effect.gen(function*() {
      yield* Effect.sleep("300 millis")
      yield* Effect.log(`Auto-saved: ${decoded.displayName}`)
      return { savedAt: new Date() }
    })
})

const autoSubmitOnBlurForm = FormSolid.make(settingsFormBuilder, {
  mode: { validation: "onBlur", autoSubmit: true },
  fields: {
    displayName: DisplayNameInput,
    bio: BioInput
  },
  onSubmit: (_, { decoded }) =>
    Effect.gen(function*() {
      yield* Effect.sleep("300 millis")
      yield* Effect.log(`Auto-saved on blur: ${decoded.displayName}`)
      return { savedAt: new Date() }
    })
})

function SaveStatus(props: { form: typeof autoSubmitOnChangeForm }) {
  const submitResult = useAtomValue(props.form.submit)

  return (
    <>
        {Result.builder(submitResult())
        .onWaiting(() => (
        <div class={`${styles.alertWarning} ${styles.alertSmall}`}>
            Saving...
        </div>
        ))
        .onSuccess((value) => (
        <div class={`${styles.alertSuccess} ${styles.alertSmall}`}>
            Saved at {value.savedAt.toLocaleTimeString()}
        </div>
        ))
        .onError(() => (
        <div class={`${styles.alertError} ${styles.alertSmall}`}>
            Failed to save
        </div>
        ))
        .orNull()}
    </>
  )
}

export function AutoSubmit() {
  return (
    <div class={styles.pageContainerLarge}>
      <h1 class={styles.pageTitle}>Auto-Submit</h1>
      <p class={styles.pageDescription}>
        Forms that automatically save when you make changes. No submit button needed!
      </p>

      <div class={styles.grid2Col}>
        <div class={styles.card}>
          <h3 class={styles.cardTitle}>Auto-save on Change</h3>
          <p class={styles.cardDescription}>
            Saves 500ms after you stop typing
          </p>
          <autoSubmitOnChangeForm.Initialize defaultValues={{ displayName: "John", bio: "Hello!" }}>
            <autoSubmitOnChangeForm.displayName />
            <autoSubmitOnChangeForm.bio />
            <SaveStatus form={autoSubmitOnChangeForm} />
          </autoSubmitOnChangeForm.Initialize>
        </div>

        <div class={styles.card}>
          <h3 class={styles.cardTitle}>Auto-save on Blur</h3>
          <p class={styles.cardDescription}>
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
