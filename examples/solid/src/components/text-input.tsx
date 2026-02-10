import type { FormSolid } from "@lucas-barake/effect-form-solid"
import * as Option from "effect/Option"
import { Show } from "solid-js"
import styles from "../styles/form.module.css"

export const TextInput: FormSolid.FieldComponent<string> = (props) => (
  <div class={styles.fieldContainer}>
    <input
      type="text"
      value={props.field.value}
      onInput={(e) => props.field.onChange(e.currentTarget.value)}
      onBlur={props.field.onBlur}
      class={`${styles.input} ${Option.isSome(props.field.error) ? styles.error : ""}`}
    />
    <Show when={props.field.isValidating}>
      <span class={styles.validatingText}>
        Validating...
      </span>
    </Show>
    <Show when={Option.isSome(props.field.error)}>
      <span class={styles.errorText}>
        {Option.getOrElse(props.field.error, () => "")}
      </span>
    </Show>
  </div>
)
