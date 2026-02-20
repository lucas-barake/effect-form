import type * as Option from "effect/Option"
import type * as Schema from "effect/Schema"

export type FieldValue<T,> = T extends Schema.Top ? Schema.Codec.Encoded<T> : T

export interface FieldState<E,> {
  readonly value: E
  readonly onChange: (value: E) => void
  readonly onBlur: () => void
  readonly error: Option.Option<string>
  readonly isTouched: boolean
  readonly isValidating: boolean
  readonly isDirty: boolean
}

export interface ArrayFieldOperations<TItem,> {
  readonly items: ReadonlyArray<TItem>
  readonly append: (value?: TItem) => void
  readonly remove: (index: number) => void
  readonly swap: (indexA: number, indexB: number) => void
  readonly move: (from: number, to: number) => void
}
