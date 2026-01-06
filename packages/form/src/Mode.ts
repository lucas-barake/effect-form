import * as Duration from "effect/Duration"

export type FormMode =
  | "onSubmit"
  | "onBlur"
  | "onChange"
  | { readonly onChange: { readonly debounce: Duration.DurationInput; readonly autoSubmit?: false } }
  | { readonly onBlur: { readonly autoSubmit: true } }
  | { readonly onChange: { readonly debounce: Duration.DurationInput; readonly autoSubmit: true } }

export type FormModeWithoutAutoSubmit =
  | "onSubmit"
  | "onBlur"
  | "onChange"
  | { readonly onChange: { readonly debounce: Duration.DurationInput; readonly autoSubmit?: false } }

export interface ParsedMode {
  readonly validation: "onSubmit" | "onBlur" | "onChange"
  readonly debounce: number | null
  readonly autoSubmit: boolean
}

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
