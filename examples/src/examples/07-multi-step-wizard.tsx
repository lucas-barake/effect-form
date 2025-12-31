import { useAtomSet, useAtomSubscribe, useAtomValue } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import { Field, FormBuilder, FormReact } from "@lucas-barake/effect-form-react"
import * as Effect from "effect/Effect"
import { constNull } from "effect/Function"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { useState } from "react"
import styles from "../styles/form.module.css"

const FirstNameField = Field.makeField(
  "firstName",
  Schema.String.pipe(Schema.nonEmptyString({ message: () => "First name is required" })),
)

const LastNameField = Field.makeField(
  "lastName",
  Schema.String.pipe(Schema.nonEmptyString({ message: () => "Last name is required" })),
)

const step1Builder = FormBuilder.empty.addField(FirstNameField).addField(LastNameField)

const FirstNameInput: React.FC<FormReact.FieldComponentProps<typeof FirstNameField.schema>> = ({ field }) => (
  <div className={styles.fieldContainer}>
    <label className={styles.label}>First Name</label>
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

const LastNameInput: React.FC<FormReact.FieldComponentProps<typeof LastNameField.schema>> = ({ field }) => (
  <div className={styles.fieldContainer}>
    <label className={styles.label}>Last Name</label>
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

const step1Form = FormReact.make(step1Builder, {
  mode: "onBlur",
  fields: {
    firstName: FirstNameInput,
    lastName: LastNameInput,
  },
  onSubmit: (_, { decoded }) => Effect.succeed(decoded),
})

const StreetField = Field.makeField(
  "street",
  Schema.String.pipe(Schema.nonEmptyString({ message: () => "Street is required" })),
)

const CityField = Field.makeField(
  "city",
  Schema.String.pipe(Schema.nonEmptyString({ message: () => "City is required" })),
)

const ZipField = Field.makeField(
  "zip",
  Schema.String.pipe(Schema.nonEmptyString({ message: () => "ZIP code is required" })),
)

const step2Builder = FormBuilder.empty.addField(StreetField).addField(CityField).addField(ZipField)

const StreetInput: React.FC<FormReact.FieldComponentProps<typeof StreetField.schema>> = ({ field }) => (
  <div className={styles.fieldContainer}>
    <label className={styles.label}>Street Address</label>
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

const CityInput: React.FC<FormReact.FieldComponentProps<typeof CityField.schema>> = ({ field }) => (
  <div className={styles.fieldContainer}>
    <label className={styles.label}>City</label>
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

const ZipInput: React.FC<FormReact.FieldComponentProps<typeof ZipField.schema>> = ({ field }) => (
  <div className={styles.fieldContainer}>
    <label className={styles.label}>ZIP Code</label>
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

const step2Form = FormReact.make(step2Builder, {
  mode: "onBlur",
  fields: {
    street: StreetInput,
    city: CityInput,
    zip: ZipInput,
  },
  onSubmit: (_, { decoded }) => Effect.succeed(decoded),
})

const finalBuilder = FormBuilder.empty.merge(step1Builder).merge(step2Builder)

const finalForm = FormReact.make(finalBuilder, {
  fields: {
    firstName: constNull,
    lastName: constNull,
    street: constNull,
    city: constNull,
    zip: constNull,
  },
  onSubmit: (_, { decoded }) =>
    Effect.gen(function*() {
      yield* Effect.sleep("1 second")
      yield* Effect.log(`Order submitted for ${decoded.firstName} ${decoded.lastName}`)
      return { orderId: `ORD-${Date.now()}` }
    }),
})

function FinalSubmitButton() {
  const submitResult = useAtomValue(finalForm.submit)

  return (
    <button
      type="submit"
      disabled={submitResult.waiting}
      className={styles.button}
    >
      {submitResult.waiting ? "Placing Order..." : "Place Order"}
    </button>
  )
}

type StepData = {
  step1: { firstName: string; lastName: string } | null
  step2: { street: string; city: string; zip: string } | null
}

function Step1({ onComplete }: { onComplete: (data: StepData["step1"]) => void }) {
  const submit = useAtomSet(step1Form.submit)
  const isDirty = useAtomValue(step1Form.isDirty)
  const submitResult = useAtomValue(step1Form.submit)

  useAtomSubscribe(step1Form.submit, (result) => {
    if (Result.isSuccess(result) && !result.waiting) {
      onComplete(result.value)
    }
  }, { immediate: false })

  const handleNext = () => {
    if (isDirty) {
      submit()
    } else if (Result.isSuccess(submitResult)) {
      onComplete(submitResult.value)
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
          disabled={submitResult.waiting}
          className={styles.button}
        >
          Next →
        </button>
      </form>
    </step1Form.Initialize>
  )
}

function Step2({
  onBack,
  onComplete,
}: {
  onComplete: (data: StepData["step2"]) => void
  onBack: () => void
}) {
  const submit = useAtomSet(step2Form.submit)
  const isDirty = useAtomValue(step2Form.isDirty)
  const submitResult = useAtomValue(step2Form.submit)

  useAtomSubscribe(step2Form.submit, (result) => {
    if (Result.isSuccess(result) && !result.waiting) {
      onComplete(result.value)
    }
  }, { immediate: false })

  const handleNext = () => {
    if (isDirty) {
      submit()
    } else if (Result.isSuccess(submitResult)) {
      onComplete(submitResult.value)
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
        <div className={styles.buttonGroup}>
          <button
            type="button"
            onClick={onBack}
            className={styles.buttonSecondary}
          >
            ← Back
          </button>
          <button
            type="submit"
            disabled={submitResult.waiting}
            className={styles.button}
          >
            Next →
          </button>
        </div>
      </form>
    </step2Form.Initialize>
  )
}

function Step3({
  data,
  onBack,
}: {
  data: StepData
  onBack: () => void
}) {
  const submit = useAtomSet(finalForm.submit)
  const submitResult = useAtomValue(finalForm.submit)

  return (
    <finalForm.Initialize
      defaultValues={{
        firstName: data.step1?.firstName ?? "",
        lastName: data.step1?.lastName ?? "",
        street: data.step2?.street ?? "",
        city: data.step2?.city ?? "",
        zip: data.step2?.zip ?? "",
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className={styles.reviewSection}>
          <h3 className={styles.reviewTitle}>Review Your Order</h3>
          <div className={`${styles.grid2Col} ${styles.gridGap16}`}>
            <div>
              <strong>Personal Info</strong>
              <p className={styles.reviewItem}>
                {data.step1?.firstName} {data.step1?.lastName}
              </p>
            </div>
            <div>
              <strong>Shipping Address</strong>
              <p className={styles.reviewItem}>{data.step2?.street}</p>
              <p className={styles.reviewItem}>
                {data.step2?.city}, {data.step2?.zip}
              </p>
            </div>
          </div>
        </div>

        {Result.builder(submitResult)
          .onSuccess((value) => (
            <div className={`${styles.alertSuccess} ${styles.marginBottom16}`}>
              Order submitted! Order ID: <strong>{value.orderId}</strong>
            </div>
          ))
          .orNull()}

        <div className={styles.buttonGroup}>
          <button
            type="button"
            onClick={onBack}
            disabled={submitResult.waiting}
            className={styles.buttonSecondary}
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
  const [currentStep, setCurrentStep] = useState(1)
  const [stepData, setStepData] = useState<StepData>({ step1: null, step2: null })

  return (
    <div className={styles.pageContainerMedium}>
      <step1Form.KeepAlive />
      <step2Form.KeepAlive />

      <h1 className={styles.pageTitle}>Multi-Step Wizard</h1>
      <p className={styles.pageDescription}>
        Three-step form using <code>.merge()</code>{" "}
        to combine builders. Each step validates independently, then merges into final form.
      </p>

      <div className={styles.progressBar}>
        {[1, 2, 3].map((step) => (
          <div
            key={step}
            className={`${styles.progressStep} ${step <= currentStep ? styles.active : ""}`}
          />
        ))}
      </div>

      <div className={styles.card}>
        <h3 className={styles.marginBottom16}>
          Step {currentStep} of 3: {currentStep === 1 ? "Personal Info" : currentStep === 2 ? "Address" : "Review"}
        </h3>

        {currentStep === 1 && (
          <Step1
            onComplete={(data) => {
              setStepData((prev) => ({ ...prev, step1: data }))
              setCurrentStep(2)
            }}
          />
        )}

        {currentStep === 2 && (
          <Step2
            onComplete={(data) => {
              setStepData((prev) => ({ ...prev, step2: data }))
              setCurrentStep(3)
            }}
            onBack={() => setCurrentStep(1)}
          />
        )}

        {currentStep === 3 && <Step3 data={stepData} onBack={() => setCurrentStep(2)} />}
      </div>
    </div>
  )
}
