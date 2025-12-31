import { useState } from "react"
import { BasicForm } from "./examples/01-basic-form"
import { ValidationModes } from "./examples/02-validation-modes"
import { ArrayFields } from "./examples/03-array-fields"
import { CrossFieldValidation } from "./examples/04-cross-field-validation"
import { AsyncValidation } from "./examples/05-async-validation"
import { AutoSubmit } from "./examples/06-auto-submit"
import { MultiStepWizard } from "./examples/07-multi-step-wizard"
import { RevertChanges } from "./examples/08-revert-changes"
import styles from "./styles/app.module.css"

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
    <div className={styles.container}>
      <nav className={styles.nav}>
        <h2 className={styles.navTitle}>Effect Form Examples</h2>
        <ul className={styles.navList}>
          {examples.map((example) => (
            <li key={example.id}>
              <button
                onClick={() => setActiveExample(example.id)}
                className={`${styles.navButton} ${activeExample === example.id ? styles.active : ""}`}
              >
                {example.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <main className={styles.main}>
        <ActiveComponent key={activeExample} />
      </main>
    </div>
  )
}
