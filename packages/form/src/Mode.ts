import * as Duration from "effect/Duration"

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
  readonly debounce: number | null
  readonly autoSubmit: boolean
}

const parseDurationInputUnsafe: (input: Duration.Input) => Duration.Duration = Duration.fromInputUnsafe

export const parse = (mode?: FormMode): ParsedMode => {
  const validation = mode?.validation ?? "onSubmit"

  if (validation === "onBlur") {
    return { validation: "onBlur", debounce: null, autoSubmit: mode?.autoSubmit === true }
  }

  if (validation === "onChange") {
    const debounceMs = mode?.debounce === undefined
      ? null
      : Duration.toMillis(parseDurationInputUnsafe(mode.debounce))
    const autoSubmit = mode?.autoSubmit === true
    return { validation: "onChange", debounce: debounceMs, autoSubmit }
  }

  return { validation: "onSubmit", debounce: null, autoSubmit: false }
}
