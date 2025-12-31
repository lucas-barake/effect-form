import { useState } from "react"
import { BasicForm } from "./examples/01-basic-form"
import { ValidationModes } from "./examples/02-validation-modes"
import { ArrayFields } from "./examples/03-array-fields"
import { CrossFieldValidation } from "./examples/04-cross-field-validation"
import { AsyncValidation } from "./examples/05-async-validation"
import { AutoSubmit } from "./examples/06-auto-submit"
import { MultiStepWizard } from "./examples/07-multi-step-wizard"
import { RevertChanges } from "./examples/08-revert-changes"

const examples = [
  { id: "basic", label: "Basic Form", component: BasicForm },
  { id: "validation-modes", label: "Validation Modes", component: ValidationModes },
  { id: "array-fields", label: "Array Fields", component: ArrayFields },
  { id: "cross-field", label: "Cross-Field Validation", component: CrossFieldValidation },
  { id: "async", label: "Async Validation", component: AsyncValidation },
  { id: "auto-submit", label: "Auto-Submit", component: AutoSubmit },
  { id: "multi-step", label: "Multi-Step Wizard", component: MultiStepWizard },
  { id: "revert", label: "Revert Changes", component: RevertChanges },
] as const

export function App() {
  const [activeExample, setActiveExample] = useState<string>("basic")
  const ActiveComponent = examples.find((e) => e.id === activeExample)?.component ?? BasicForm

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
      <nav
        style={{
          width: 220,
          padding: 16,
          borderRight: "1px solid #e5e7eb",
          backgroundColor: "#f9fafb",
        }}
      >
        <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>Effect Form Examples</h2>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {examples.map((example) => (
            <li key={example.id}>
              <button
                onClick={() => setActiveExample(example.id)}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  marginBottom: 4,
                  border: "none",
                  borderRadius: 4,
                  backgroundColor: activeExample === example.id ? "#2563eb" : "transparent",
                  color: activeExample === example.id ? "white" : "#374151",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: 14,
                }}
              >
                {example.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <main style={{ flex: 1, padding: 32 }}>
        <ActiveComponent key={activeExample} />
      </main>
    </div>
  )
}
