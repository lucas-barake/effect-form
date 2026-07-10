import type * as Duration from "effect/Duration"

export type FormMode =
  | { readonly validation?: "onSubmit"; readonly autoSubmit?: false; readonly debounce?: never }
  | { readonly validation: "onBlur"; readonly autoSubmit?: boolean; readonly debounce?: never }
  | { readonly validation: "onChange"; readonly debounce?: Duration.Input; readonly autoSubmit?: boolean }

export type FormModeWithoutAutoSubmit =
  | { readonly validation?: "onSubmit"; readonly autoSubmit?: false; readonly debounce?: never }
  | { readonly validation: "onBlur"; readonly autoSubmit?: false; readonly debounce?: never }
  | { readonly validation: "onChange"; readonly debounce?: Duration.Input; readonly autoSubmit?: false }

export interface ParsedMode {
  readonly validation: "onSubmit" | "onBlur" | "onChange"
  readonly debounce: Duration.Input | null
  readonly autoSubmit: boolean
}

export const parse = (mode?: FormMode): ParsedMode => {
  const validation = mode?.validation ?? "onSubmit"

  if (validation === "onBlur") {
    return { validation: "onBlur", debounce: null, autoSubmit: mode?.autoSubmit === true }
  }

  if (validation === "onChange") {
    return { validation: "onChange", debounce: mode?.debounce ?? null, autoSubmit: mode?.autoSubmit === true }
  }

  return { validation: "onSubmit", debounce: null, autoSubmit: false }
}
