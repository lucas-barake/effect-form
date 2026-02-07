import * as Duration from "effect/Duration"

export type FormMode =
  | { readonly validation?: "onSubmit"; readonly autoSubmit?: false; readonly debounce?: never }
  | { readonly validation: "onBlur"; readonly autoSubmit?: boolean; readonly debounce?: never }
  | { readonly validation: "onChange"; readonly debounce?: Duration.DurationInput; readonly autoSubmit?: boolean }

export type FormModeWithoutAutoSubmit =
  | { readonly validation?: "onSubmit"; readonly autoSubmit?: false; readonly debounce?: never }
  | { readonly validation: "onBlur"; readonly autoSubmit?: false; readonly debounce?: never }
  | { readonly validation: "onChange"; readonly debounce?: Duration.DurationInput; readonly autoSubmit?: false }

export interface ParsedMode {
  readonly validation: "onSubmit" | "onBlur" | "onChange"
  readonly debounce: number | null
  readonly autoSubmit: boolean
}

export const parse = (mode?: FormMode): ParsedMode => {
  const validation = mode?.validation ?? "onSubmit"

  if (validation === "onBlur") {
    return { validation: "onBlur", debounce: null, autoSubmit: mode?.autoSubmit === true }
  }

  if (validation === "onChange") {
    const debounceMs = mode?.debounce === undefined ? null : Duration.toMillis(mode.debounce)
    const autoSubmit = mode?.autoSubmit === true
    return { validation: "onChange", debounce: debounceMs, autoSubmit }
  }

  return { validation: "onSubmit", debounce: null, autoSubmit: false }
}
