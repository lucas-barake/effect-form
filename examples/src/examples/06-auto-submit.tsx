import { useAtomValue } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import { Field, FormBuilder, FormReact } from "@lucas-barake/effect-form-react"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import styles from "../styles/form.module.css"

const DisplayNameField = Field.makeField(
  "displayName",
  Schema.String.pipe(Schema.nonEmptyString({ message: () => "Display name is required" })),
)

const BioField = Field.makeField("bio", Schema.String)

const settingsFormBuilder = FormBuilder.empty.addField(DisplayNameField).addField(BioField)

const DisplayNameInput: FormReact.FieldComponent<string> = ({ field }) => (
  <div className={styles.fieldContainer}>
    <label className={styles.label}>Display Name</label>
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

const BioInput: FormReact.FieldComponent<string> = ({ field }) => (
  <div className={styles.fieldContainer}>
    <label className={styles.label}>Bio</label>
    <input
      type="text"
      value={field.value}
      onChange={(e) =>
        field.onChange(e.target.value)}
      onBlur={field.onBlur}
      className={styles.input}
    />
  </div>
)

const autoSubmitOnChangeForm = FormReact.make(settingsFormBuilder, {
  mode: { onChange: { debounce: "500 millis", autoSubmit: true } },
  fields: {
    displayName: DisplayNameInput,
    bio: BioInput,
  },
  onSubmit: (_, { decoded }) =>
    Effect.gen(function*() {
      yield* Effect.sleep("300 millis")
      yield* Effect.log(`Auto-saved: ${decoded.displayName}`)
      return { savedAt: new Date() }
    }),
})

const autoSubmitOnBlurForm = FormReact.make(settingsFormBuilder, {
  mode: { onBlur: { autoSubmit: true } },
  fields: {
    displayName: DisplayNameInput,
    bio: BioInput,
  },
  onSubmit: (_, { decoded }) =>
    Effect.gen(function*() {
      yield* Effect.sleep("300 millis")
      yield* Effect.log(`Auto-saved on blur: ${decoded.displayName}`)
      return { savedAt: new Date() }
    }),
})

function SaveStatus({ form }: { form: typeof autoSubmitOnChangeForm }) {
  const submitResult = useAtomValue(form.submit)

  return Result.builder(submitResult)
    .onWaiting(() => (
      <div className={`${styles.alertWarning} ${styles.alertSmall}`}>
        Saving...
      </div>
    ))
    .onSuccess((value) => (
      <div className={`${styles.alertSuccess} ${styles.alertSmall}`}>
        Saved at {value.savedAt.toLocaleTimeString()}
      </div>
    ))
    .onError(() => (
      <div className={`${styles.alertError} ${styles.alertSmall}`}>
        Failed to save
      </div>
    ))
    .orNull()
}

export function AutoSubmit() {
  return (
    <div className={styles.pageContainerLarge}>
      <h1 className={styles.pageTitle}>Auto-Submit</h1>
      <p className={styles.pageDescription}>
        Forms that automatically save when you make changes. No submit button needed!
      </p>

      <div className={styles.grid2Col}>
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Auto-save on Change</h3>
          <p className={styles.cardDescription}>
            Saves 500ms after you stop typing
          </p>
          <autoSubmitOnChangeForm.Initialize defaultValues={{ displayName: "John", bio: "Hello!" }}>
            <autoSubmitOnChangeForm.displayName />
            <autoSubmitOnChangeForm.bio />
            <SaveStatus form={autoSubmitOnChangeForm} />
          </autoSubmitOnChangeForm.Initialize>
        </div>

        <div className={styles.card}>
          <h3 className={styles.cardTitle}>Auto-save on Blur</h3>
          <p className={styles.cardDescription}>
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
