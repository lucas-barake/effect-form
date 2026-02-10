import { useAtomSet, useAtomValue } from "@effectify/solid-effect-atom"
import * as Result from "@effect-atom/atom/Result"
import { Field, FormBuilder, FormSolid } from "@lucas-barake/effect-form-solid"
import * as Effect from "effect/Effect"
import { constNull } from "effect/Function"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { createSignal, createEffect, on, For, Show } from "solid-js"
import styles from "../styles/form.module.css"

const FirstNameField = Field.makeField(
  "firstName",
  Schema.String.pipe(Schema.nonEmptyString({ message: () => "First name is required" }))
)

const LastNameField = Field.makeField(
  "lastName",
  Schema.String.pipe(Schema.nonEmptyString({ message: () => "Last name is required" }))
)

const step1Builder = FormBuilder.empty.addField(FirstNameField).addField(LastNameField)

const FirstNameInput: FormSolid.FieldComponent<string> = (props) => (
  <div class={styles.fieldContainer}>
    <label class={styles.label}>First Name</label>
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

const LastNameInput: FormSolid.FieldComponent<string> = (props) => (
  <div class={styles.fieldContainer}>
    <label class={styles.label}>Last Name</label>
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

const step1Form = FormSolid.make(step1Builder, {
  mode: { validation: "onBlur" },
  fields: {
    firstName: FirstNameInput,
    lastName: LastNameInput
  },
  onSubmit: (_, { decoded }) => Effect.succeed(decoded)
})

const StreetField = Field.makeField(
  "street",
  Schema.String.pipe(Schema.nonEmptyString({ message: () => "Street is required" }))
)

const CityField = Field.makeField(
  "city",
  Schema.String.pipe(Schema.nonEmptyString({ message: () => "City is required" }))
)

const ZipField = Field.makeField(
  "zip",
  Schema.String.pipe(Schema.nonEmptyString({ message: () => "ZIP code is required" }))
)

const step2Builder = FormBuilder.empty.addField(StreetField).addField(CityField).addField(ZipField)

const StreetInput: FormSolid.FieldComponent<string> = (props) => (
  <div class={styles.fieldContainer}>
    <label class={styles.label}>Street Address</label>
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

const CityInput: FormSolid.FieldComponent<string> = (props) => (
  <div class={styles.fieldContainer}>
    <label class={styles.label}>City</label>
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

const ZipInput: FormSolid.FieldComponent<string> = (props) => (
  <div class={styles.fieldContainer}>
    <label class={styles.label}>ZIP Code</label>
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

const step2Form = FormSolid.make(step2Builder, {
  mode: { validation: "onBlur" },
  fields: {
    street: StreetInput,
    city: CityInput,
    zip: ZipInput
  },
  onSubmit: (_, { decoded }) => Effect.succeed(decoded)
})

const finalBuilder = FormBuilder.empty.merge(step1Builder).merge(step2Builder)

const finalForm = FormSolid.make(finalBuilder, {
  fields: {
    firstName: constNull,
    lastName: constNull,
    street: constNull,
    city: constNull,
    zip: constNull
  },
  onSubmit: (_, { decoded }) =>
    Effect.gen(function*() {
      yield* Effect.sleep("1 second")
      yield* Effect.log(`Order submitted for ${decoded.firstName} ${decoded.lastName}`)
      return { orderId: `ORD-${Date.now()}` }
    })
})

function FinalSubmitButton() {
  const submitResult = useAtomValue(finalForm.submit)

  return (
    <button
      type="submit"
      disabled={submitResult().waiting}
      class={styles.button}
    >
      {submitResult().waiting ? "Placing Order..." : "Place Order"}
    </button>
  )
}

type StepData = {
  step1: { firstName: string; lastName: string } | null
  step2: { street: string; city: string; zip: string } | null
}

function Step1(props: { onComplete: (data: StepData["step1"]) => void }) {
  const submit = useAtomSet(step1Form.submit)
  const isDirty = useAtomValue(step1Form.isDirty)
  const submitResult = useAtomValue(step1Form.submit)

  createEffect(on(submitResult, (result) => {
    if (Result.isSuccess(result) && !result.waiting) {
      props.onComplete(result.value)
    }
  }, { defer: true }))

  const handleNext = () => {
    const res = submitResult()
    if (isDirty()) {
      submit()
    } else if (Result.isSuccess(res)) {
      props.onComplete(res.value)
    }
  }

  return (
    <step1Form.Initialize defaultValues={{ firstName: "", lastName: "" }}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleNext()
        }}
      >
        <step1Form.firstName />
        <step1Form.lastName />
        <button
          type="submit"
          disabled={submitResult().waiting}
          class={styles.button}
        >
          Next →
        </button>
      </form>
    </step1Form.Initialize>
  )
}

function Step2(props: {
  onComplete: (data: StepData["step2"]) => void
  onBack: () => void
}) {
  const submit = useAtomSet(step2Form.submit)
  const isDirty = useAtomValue(step2Form.isDirty)
  const submitResult = useAtomValue(step2Form.submit)

  createEffect(on(submitResult, (result) => {
    if (Result.isSuccess(result) && !result.waiting) {
      props.onComplete(result.value)
    }
  }, { defer: true }))

  const handleNext = () => {
    const res = submitResult()
    if (isDirty()) {
      submit()
    } else if (Result.isSuccess(res)) {
      props.onComplete(res.value)
    }
  }

  return (
    <step2Form.Initialize defaultValues={{ street: "", city: "", zip: "" }}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleNext()
        }}
      >
        <step2Form.street />
        <step2Form.city />
        <step2Form.zip />
        <div class={styles.buttonGroup}>
          <button
            type="button"
            onClick={props.onBack}
            class={styles.buttonSecondary}
          >
            ← Back
          </button>
          <button
            type="submit"
            disabled={submitResult().waiting}
            class={styles.button}
          >
            Next →
          </button>
        </div>
      </form>
    </step2Form.Initialize>
  )
}

function Step3(props: {
  data: StepData
  onBack: () => void
}) {
  const submit = useAtomSet(finalForm.submit)
  const submitResult = useAtomValue(finalForm.submit)

  return (
    <finalForm.Initialize
      defaultValues={{
        firstName: props.data.step1?.firstName ?? "",
        lastName: props.data.step1?.lastName ?? "",
        street: props.data.step2?.street ?? "",
        city: props.data.step2?.city ?? "",
        zip: props.data.step2?.zip ?? ""
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div class={styles.reviewSection}>
          <h3 class={styles.reviewTitle}>Review Your Order</h3>
          <div class={`${styles.grid2Col} ${styles.gridGap16}`}>
            <div>
              <strong>Personal Info</strong>
              <p class={styles.reviewItem}>
                {props.data.step1?.firstName} {props.data.step1?.lastName}
              </p>
            </div>
            <div>
              <strong>Shipping Address</strong>
              <p class={styles.reviewItem}>{props.data.step2?.street}</p>
              <p class={styles.reviewItem}>
                {props.data.step2?.city}, {props.data.step2?.zip}
              </p>
            </div>
          </div>
        </div>

        <Show when={Result.isSuccess(submitResult())}>
            <div class={`${styles.alertSuccess} ${styles.marginBottom16}`}>
              Order submitted! Order ID: <strong>{(submitResult() as any).value.orderId}</strong>
            </div>
        </Show>

        <div class={styles.buttonGroup}>
          <button
            type="button"
            onClick={props.onBack}
            disabled={submitResult().waiting}
            class={styles.buttonSecondary}
          >
            ← Back
          </button>
          <FinalSubmitButton />
        </div>
      </form>
    </finalForm.Initialize>
  )
}

export function MultiStepWizard() {
  const [currentStep, setCurrentStep] = createSignal(1)
  const [stepData, setStepData] = createSignal<StepData>({ step1: null, step2: null })

  return (
    <div class={styles.pageContainerMedium}>
      <step1Form.KeepAlive />
      <step2Form.KeepAlive />

      <h1 class={styles.pageTitle}>Multi-Step Wizard</h1>
      <p class={styles.pageDescription}>
        Three-step form using <code>.merge()</code>{" "}
        to combine builders. Each step validates independently, then merges into final form.
      </p>

      <div class={styles.progressBar}>
        {[1, 2, 3].map((step) => (
          <div
            class={`${styles.progressStep} ${step <= currentStep() ? styles.active : ""}`}
          />
        ))}
      </div>

      <div class={styles.card}>
        <h3 class={styles.marginBottom16}>
          Step {currentStep()} of 3: {currentStep() === 1 ? "Personal Info" : currentStep() === 2 ? "Address" : "Review"}
        </h3>

        <Show when={currentStep() === 1}>
          <Step1
            onComplete={(data) => {
              setStepData((prev) => ({ ...prev, step1: data }))
              setCurrentStep(2)
            }}
          />
        </Show>

        <Show when={currentStep() === 2}>
          <Step2
            onComplete={(data) => {
              setStepData((prev) => ({ ...prev, step2: data }))
              setCurrentStep(3)
            }}
            onBack={() => setCurrentStep(1)}
          />
        </Show>

        <Show when={currentStep() === 3}>
            <Step3 data={stepData()} onBack={() => setCurrentStep(2)} />
        </Show>
      </div>
    </div>
  )
}
