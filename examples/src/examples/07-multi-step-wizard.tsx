import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import * as Result from "@effect-atom/atom/Result"
import { Field, FormBuilder, FormReact } from "@lucas-barake/effect-form-react"
import * as Effect from "effect/Effect"
import { constNull } from "effect/Function"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { useState } from "react"

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
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>First Name</label>
    <input
      type="text"
      value={field.value}
      onChange={(e) =>
        field.onChange(e.target.value)}
      onBlur={field.onBlur}
      style={{
        padding: "8px 12px",
        border: Option.isSome(field.error) ? "1px solid #dc2626" : "1px solid #ccc",
        borderRadius: 4,
        width: "100%",
        boxSizing: "border-box",
      }}
    />
    {Option.isSome(field.error) && (
      <span style={{ color: "#dc2626", fontSize: 12, marginTop: 4, display: "block" }}>{field.error.value}</span>
    )}
  </div>
)

const LastNameInput: React.FC<FormReact.FieldComponentProps<typeof LastNameField.schema>> = ({ field }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Last Name</label>
    <input
      type="text"
      value={field.value}
      onChange={(e) =>
        field.onChange(e.target.value)}
      onBlur={field.onBlur}
      style={{
        padding: "8px 12px",
        border: Option.isSome(field.error) ? "1px solid #dc2626" : "1px solid #ccc",
        borderRadius: 4,
        width: "100%",
        boxSizing: "border-box",
      }}
    />
    {Option.isSome(field.error) && (
      <span style={{ color: "#dc2626", fontSize: 12, marginTop: 4, display: "block" }}>{field.error.value}</span>
    )}
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
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>Street Address</label>
    <input
      type="text"
      value={field.value}
      onChange={(e) =>
        field.onChange(e.target.value)}
      onBlur={field.onBlur}
      style={{
        padding: "8px 12px",
        border: Option.isSome(field.error) ? "1px solid #dc2626" : "1px solid #ccc",
        borderRadius: 4,
        width: "100%",
        boxSizing: "border-box",
      }}
    />
    {Option.isSome(field.error) && (
      <span style={{ color: "#dc2626", fontSize: 12, marginTop: 4, display: "block" }}>{field.error.value}</span>
    )}
  </div>
)

const CityInput: React.FC<FormReact.FieldComponentProps<typeof CityField.schema>> = ({ field }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>City</label>
    <input
      type="text"
      value={field.value}
      onChange={(e) =>
        field.onChange(e.target.value)}
      onBlur={field.onBlur}
      style={{
        padding: "8px 12px",
        border: Option.isSome(field.error) ? "1px solid #dc2626" : "1px solid #ccc",
        borderRadius: 4,
        width: "100%",
        boxSizing: "border-box",
      }}
    />
    {Option.isSome(field.error) && (
      <span style={{ color: "#dc2626", fontSize: 12, marginTop: 4, display: "block" }}>{field.error.value}</span>
    )}
  </div>
)

const ZipInput: React.FC<FormReact.FieldComponentProps<typeof ZipField.schema>> = ({ field }) => (
  <div style={{ marginBottom: 16 }}>
    <label style={{ display: "block", marginBottom: 4, fontWeight: 500 }}>ZIP Code</label>
    <input
      type="text"
      value={field.value}
      onChange={(e) =>
        field.onChange(e.target.value)}
      onBlur={field.onBlur}
      style={{
        padding: "8px 12px",
        border: Option.isSome(field.error) ? "1px solid #dc2626" : "1px solid #ccc",
        borderRadius: 4,
        width: "100%",
        boxSizing: "border-box",
      }}
    />
    {Option.isSome(field.error) && (
      <span style={{ color: "#dc2626", fontSize: 12, marginTop: 4, display: "block" }}>{field.error.value}</span>
    )}
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
  const isDirty = useAtomValue(finalForm.isDirty)
  const submitResult = useAtomValue(finalForm.submit)

  return (
    <button
      type="submit"
      disabled={!isDirty || submitResult.waiting}
      style={{
        padding: "10px 20px",
        backgroundColor: !isDirty || submitResult.waiting ? "#ccc" : "#2563eb",
        color: "white",
        border: "none",
        borderRadius: 4,
        cursor: !isDirty || submitResult.waiting ? "not-allowed" : "pointer",
      }}
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
  const submitResult = useAtomValue(step1Form.submit)

  if (Result.isSuccess(submitResult) && !submitResult.waiting) {
    onComplete(submitResult.value)
  }

  return (
    <step1Form.Initialize defaultValues={{ firstName: "", lastName: "" }}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <step1Form.firstName />
        <step1Form.lastName />
        <button
          type="submit"
          disabled={submitResult.waiting}
          style={{
            padding: "10px 20px",
            backgroundColor: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
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
  const submitResult = useAtomValue(step2Form.submit)

  if (Result.isSuccess(submitResult) && !submitResult.waiting) {
    onComplete(submitResult.value)
  }

  return (
    <step2Form.Initialize defaultValues={{ street: "", city: "", zip: "" }}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <step2Form.street />
        <step2Form.city />
        <step2Form.zip />
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              padding: "10px 20px",
              backgroundColor: "#6b7280",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            ← Back
          </button>
          <button
            type="submit"
            disabled={submitResult.waiting}
            style={{
              padding: "10px 20px",
              backgroundColor: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
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
        <div style={{ backgroundColor: "#f9fafb", padding: 16, borderRadius: 8, marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 12px" }}>Review Your Order</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <strong>Personal Info</strong>
              <p style={{ margin: "4px 0" }}>
                {data.step1?.firstName} {data.step1?.lastName}
              </p>
            </div>
            <div>
              <strong>Shipping Address</strong>
              <p style={{ margin: "4px 0" }}>{data.step2?.street}</p>
              <p style={{ margin: "4px 0" }}>
                {data.step2?.city}, {data.step2?.zip}
              </p>
            </div>
          </div>
        </div>

        {Result.builder(submitResult)
          .onSuccess((value) => (
            <div style={{ padding: 16, backgroundColor: "#dcfce7", borderRadius: 8, marginBottom: 16 }}>
              Order submitted! Order ID: <strong>{value.orderId}</strong>
            </div>
          ))
          .orNull()}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onBack}
            disabled={submitResult.waiting}
            style={{
              padding: "10px 20px",
              backgroundColor: "#6b7280",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
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
    <div style={{ maxWidth: 500 }}>
      <h1 style={{ marginTop: 0, marginBottom: 8 }}>Multi-Step Wizard</h1>
      <p style={{ color: "#6b7280", marginBottom: 24 }}>
        Three-step form using <code>.merge()</code>{" "}
        to combine builders. Each step validates independently, then merges into final form.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        {[1, 2, 3].map((step) => (
          <div
            key={step}
            style={{
              flex: 1,
              height: 4,
              backgroundColor: step <= currentStep ? "#2563eb" : "#e5e7eb",
              borderRadius: 2,
            }}
          />
        ))}
      </div>

      <div style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 8 }}>
        <h3 style={{ margin: "0 0 16px" }}>
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
