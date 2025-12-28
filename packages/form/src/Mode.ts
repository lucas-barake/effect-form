/**
 * Form validation mode configuration.
 *
 * @since 1.0.0
 */
import * as Duration from "effect/Duration"

/**
 * Controls when field validation is triggered and whether form auto-submits.
 *
 * Simple modes (string):
 * - `"onSubmit"`: Validation only runs when the form is submitted (default)
 * - `"onBlur"`: Validation runs when a field loses focus
 * - `"onChange"`: Validation runs on every value change (sync)
 *
 * Object modes (with options):
 * - `{ onChange: { debounce, autoSubmit? } }`: Debounced validation, optional auto-submit
 * - `{ onBlur: { autoSubmit: true } }`: Validate on blur, auto-submit when valid
 *
 * @since 1.0.0
 * @category Models
 */
export type FormMode =
  | "onSubmit"
  | "onBlur"
  | "onChange"
  | { readonly onChange: { readonly debounce: Duration.DurationInput; readonly autoSubmit?: false } }
  | { readonly onBlur: { readonly autoSubmit: true } }
  | { readonly onChange: { readonly debounce: Duration.DurationInput; readonly autoSubmit: true } }

/**
 * Form mode without auto-submit options.
 * Used when SubmitArgs is not void, since auto-submit cannot provide custom arguments.
 *
 * @since 1.0.0
 * @category Models
 */
export type FormModeWithoutAutoSubmit =
  | "onSubmit"
  | "onBlur"
  | "onChange"
  | { readonly onChange: { readonly debounce: Duration.DurationInput; readonly autoSubmit?: false } }

/**
 * Parsed form mode with resolved values.
 *
 * @since 1.0.0
 * @category Models
 */
export interface ParsedMode {
  readonly validation: "onSubmit" | "onBlur" | "onChange"
  readonly debounce: number | null
  readonly autoSubmit: boolean
}

/**
 * Parses a FormMode into a normalized ParsedMode.
 *
 * @since 1.0.0
 * @category Parsing
 */
export const parse = (mode: FormMode = "onSubmit"): ParsedMode => {
  if (typeof mode === "string") {
    return { validation: mode, debounce: null, autoSubmit: false }
  }
  if ("onBlur" in mode) {
    return { validation: "onBlur", debounce: null, autoSubmit: true }
  }
  const debounceMs = Duration.toMillis(mode.onChange.debounce)
  const autoSubmit = mode.onChange.autoSubmit === true
  return { validation: "onChange", debounce: debounceMs, autoSubmit }
}
