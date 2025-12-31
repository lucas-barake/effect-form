import type { FormReact } from "@lucas-barake/effect-form-react"
import * as Option from "effect/Option"
import type * as Schema from "effect/Schema"
import styles from "../styles/form.module.css"

export const TextInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({ field }) => (
  <div className={styles.fieldContainer}>
    <input
      type="text"
      value={field.value}
      onChange={(e) =>
        field.onChange(e.target.value)}
      onBlur={field.onBlur}
      className={`${styles.input} ${Option.isSome(field.error) ? styles.error : ""}`}
    />
    {field.isValidating && (
      <span className={styles.validatingText}>
        Validating...
      </span>
    )}
    {Option.isSome(field.error) && (
      <span className={styles.errorText}>
        {field.error.value}
      </span>
    )}
  </div>
)
