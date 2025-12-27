/**
 * Atom infrastructure for form state management.
 *
 * This module provides the core atom infrastructure that framework adapters
 * (React, Vue, Svelte, Solid) can use to build reactive form components.
 *
 * @since 1.0.0
 */
import * as Atom from "@effect-atom/atom/Atom"
import type * as Registry from "@effect-atom/atom/Registry"
import * as Effect from "effect/Effect"
import * as Equal from "effect/Equal"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type * as ParseResult from "effect/ParseResult"
import * as Schema from "effect/Schema"
import * as Utils from "effect/Utils"
import type * as Form from "./Form.js"
import { buildSchema, createTouchedRecord, getDefaultFromSchema, makeFieldRef } from "./Form.js"
import { recalculateDirtyFieldsForArray, recalculateDirtySubtree } from "./internal/dirty.js"
import { getNestedValue, setNestedValue } from "./internal/path.js"
import { createWeakRegistry, type WeakRegistry } from "./internal/weak-registry.js"

/**
 * Atoms for a single field.
 *
 * @since 1.0.0
 * @category Models
 */
export interface FieldAtoms {
  readonly valueAtom: Atom.Writable<unknown, unknown>
  readonly initialValueAtom: Atom.Atom<unknown>
  readonly touchedAtom: Atom.Writable<boolean, boolean>
  readonly crossFieldErrorAtom: Atom.Atom<Option.Option<string>>
}

/**
 * Configuration for creating form atoms.
 *
 * @since 1.0.0
 * @category Models
 */
export interface FormAtomsConfig<TFields extends Form.FieldsRecord, R> {
  readonly runtime: Atom.AtomRuntime<R, any>
  readonly formBuilder: Form.FormBuilder<TFields, R>
}

/**
 * Maps field names to their type-safe Field references for setValue operations.
 *
 * @since 1.0.0
 * @category Models
 */
export type FieldRefs<TFields extends Form.FieldsRecord> = {
  readonly [K in keyof TFields]: TFields[K] extends Form.FieldDef<any, infer S> ? Form.Field<Schema.Schema.Encoded<S>>
    : TFields[K] extends Form.ArrayFieldDef<any, infer S> ? Form.Field<ReadonlyArray<Schema.Schema.Encoded<S>>>
    : never
}

/**
 * The complete form atoms infrastructure.
 *
 * @since 1.0.0
 * @category Models
 */
export interface FormAtoms<TFields extends Form.FieldsRecord, R> {
  readonly stateAtom: Atom.Writable<Option.Option<Form.FormState<TFields>>, Option.Option<Form.FormState<TFields>>>
  readonly crossFieldErrorsAtom: Atom.Writable<Map<string, string>, Map<string, string>>
  readonly dirtyFieldsAtom: Atom.Atom<ReadonlySet<string>>
  readonly isDirtyAtom: Atom.Atom<boolean>
  readonly submitCountAtom: Atom.Atom<number>
  readonly onSubmitAtom: Atom.Writable<
    Atom.AtomResultFn<Form.DecodedFromFields<TFields>, unknown, unknown> | null,
    Atom.AtomResultFn<Form.DecodedFromFields<TFields>, unknown, unknown> | null
  >

  readonly decodeAndSubmit: Atom.AtomResultFn<Form.EncodedFromFields<TFields>, unknown, unknown>

  readonly combinedSchema: Schema.Schema<Form.DecodedFromFields<TFields>, Form.EncodedFromFields<TFields>, R>

  readonly fieldRefs: FieldRefs<TFields>

  readonly validationAtomsRegistry: WeakRegistry<Atom.AtomResultFn<unknown, void, ParseResult.ParseError>>
  readonly fieldAtomsRegistry: WeakRegistry<FieldAtoms>

  readonly getOrCreateValidationAtom: (
    fieldPath: string,
    schema: Schema.Schema.Any,
  ) => Atom.AtomResultFn<unknown, void, ParseResult.ParseError>

  readonly getOrCreateFieldAtoms: (fieldPath: string) => FieldAtoms

  readonly resetValidationAtoms: (registry: Registry.Registry) => void

  readonly operations: FormOperations<TFields>
}

/**
 * Pure state operations for form manipulation.
 *
 * @since 1.0.0
 * @category Models
 */
export interface FormOperations<TFields extends Form.FieldsRecord> {
  /**
   * Creates the initial form state from default values.
   */
  readonly createInitialState: (defaultValues: Form.EncodedFromFields<TFields>) => Form.FormState<TFields>

  /**
   * Creates a reset state (back to initial values).
   */
  readonly createResetState: (state: Form.FormState<TFields>) => Form.FormState<TFields>

  /**
   * Creates state with all fields marked as touched and submit count incremented.
   */
  readonly createSubmitState: (state: Form.FormState<TFields>) => Form.FormState<TFields>

  /**
   * Updates a single field value in the state.
   */
  readonly setFieldValue: (
    state: Form.FormState<TFields>,
    fieldPath: string,
    value: unknown,
  ) => Form.FormState<TFields>

  /**
   * Sets all form values, recalculating dirty fields.
   */
  readonly setFormValues: (
    state: Form.FormState<TFields>,
    values: Form.EncodedFromFields<TFields>,
  ) => Form.FormState<TFields>

  /**
   * Sets a field as touched.
   */
  readonly setFieldTouched: (
    state: Form.FormState<TFields>,
    fieldPath: string,
    touched: boolean,
  ) => Form.FormState<TFields>

  /**
   * Appends an item to an array field.
   */
  readonly appendArrayItem: (
    state: Form.FormState<TFields>,
    arrayPath: string,
    itemSchema: Schema.Schema.Any,
    value?: unknown,
  ) => Form.FormState<TFields>

  /**
   * Removes an item from an array field.
   */
  readonly removeArrayItem: (
    state: Form.FormState<TFields>,
    arrayPath: string,
    index: number,
  ) => Form.FormState<TFields>

  /**
   * Swaps two items in an array field.
   */
  readonly swapArrayItems: (
    state: Form.FormState<TFields>,
    arrayPath: string,
    indexA: number,
    indexB: number,
  ) => Form.FormState<TFields>

  /**
   * Moves an item in an array field.
   */
  readonly moveArrayItem: (
    state: Form.FormState<TFields>,
    arrayPath: string,
    fromIndex: number,
    toIndex: number,
  ) => Form.FormState<TFields>
}

/**
 * Creates the complete form atoms infrastructure.
 *
 * @example
 * ```ts
 * import * as FormAtoms from "@lucas-barake/effect-form/FormAtoms"
 * import * as Form from "@lucas-barake/effect-form"
 * import * as Atom from "@effect-atom/atom/Atom"
 * import * as Layer from "effect/Layer"
 *
 * const runtime = Atom.runtime(Layer.empty)
 *
 * const loginForm = Form.empty
 *   .addField(Form.makeField("email", Schema.String))
 *   .addField(Form.makeField("password", Schema.String))
 *
 * const atoms = FormAtoms.make({
 *   runtime,
 *   formBuilder: loginForm,
 *   parsedMode: { validation: "onChange", debounce: 300, autoSubmit: false }
 * })
 * ```
 *
 * @since 1.0.0
 * @category Constructors
 */
export const make = <TFields extends Form.FieldsRecord, R>(
  config: FormAtomsConfig<TFields, R>,
): FormAtoms<TFields, R> => {
  const { formBuilder, runtime } = config
  const { fields } = formBuilder

  const combinedSchema = buildSchema(formBuilder)

  const stateAtom = Atom.make(Option.none<Form.FormState<TFields>>()).pipe(Atom.setIdleTTL(0))
  const crossFieldErrorsAtom = Atom.make<Map<string, string>>(new Map()).pipe(Atom.setIdleTTL(0))

  const dirtyFieldsAtom = Atom.readable((get) => Option.getOrThrow(get(stateAtom)).dirtyFields).pipe(
    Atom.setIdleTTL(0),
  )

  const isDirtyAtom = Atom.readable((get) => Option.getOrThrow(get(stateAtom)).dirtyFields.size > 0).pipe(
    Atom.setIdleTTL(0),
  )

  const submitCountAtom = Atom.readable((get) => Option.getOrThrow(get(stateAtom)).submitCount).pipe(
    Atom.setIdleTTL(0),
  )

  const onSubmitAtom = Atom.make<Atom.AtomResultFn<Form.DecodedFromFields<TFields>, unknown, unknown> | null>(
    null,
  ).pipe(Atom.setIdleTTL(0))

  const updateDirtyFields = (
    state: Form.FormState<TFields>,
    fieldPath: string,
    newValue: unknown,
  ): ReadonlySet<string> => {
    const initialValue = getNestedValue(state.initialValues, fieldPath)
    const isEqual = Utils.structuralRegion(() => Equal.equals(newValue, initialValue))

    const newDirtyFields = new Set(state.dirtyFields)
    if (!isEqual) {
      newDirtyFields.add(fieldPath)
    } else {
      newDirtyFields.delete(fieldPath)
    }
    return newDirtyFields
  }

  const validationAtomsRegistry = createWeakRegistry<Atom.AtomResultFn<unknown, void, ParseResult.ParseError>>()
  const fieldAtomsRegistry = createWeakRegistry<FieldAtoms>()

  const getOrCreateValidationAtom = (
    fieldPath: string,
    schema: Schema.Schema.Any,
  ): Atom.AtomResultFn<unknown, void, ParseResult.ParseError> => {
    const existing = validationAtomsRegistry.get(fieldPath)
    if (existing) return existing

    const validationAtom = runtime.fn<unknown>()((value: unknown) =>
      pipe(
        Schema.decodeUnknown(schema)(value) as Effect.Effect<unknown, ParseResult.ParseError, R>,
        Effect.asVoid,
      )
    ).pipe(Atom.setIdleTTL(0)) as Atom.AtomResultFn<unknown, void, ParseResult.ParseError>

    validationAtomsRegistry.set(fieldPath, validationAtom)
    return validationAtom
  }

  const getOrCreateFieldAtoms = (fieldPath: string): FieldAtoms => {
    const existing = fieldAtomsRegistry.get(fieldPath)
    if (existing) return existing

    const valueAtom = Atom.writable(
      (get) => getNestedValue(Option.getOrThrow(get(stateAtom)).values, fieldPath),
      (ctx, value) => {
        const currentState = Option.getOrThrow(ctx.get(stateAtom))
        ctx.set(
          stateAtom,
          Option.some({
            ...currentState,
            values: setNestedValue(currentState.values, fieldPath, value),
            dirtyFields: updateDirtyFields(currentState, fieldPath, value),
          }),
        )
      },
    ).pipe(Atom.setIdleTTL(0))

    const initialValueAtom = Atom.readable(
      (get) => getNestedValue(Option.getOrThrow(get(stateAtom)).initialValues, fieldPath),
    ).pipe(Atom.setIdleTTL(0))

    const touchedAtom = Atom.writable(
      (get) => (getNestedValue(Option.getOrThrow(get(stateAtom)).touched, fieldPath) ?? false) as boolean,
      (ctx, value) => {
        const currentState = Option.getOrThrow(ctx.get(stateAtom))
        ctx.set(
          stateAtom,
          Option.some({
            ...currentState,
            touched: setNestedValue(currentState.touched, fieldPath, value),
          }),
        )
      },
    ).pipe(Atom.setIdleTTL(0))

    const crossFieldErrorAtom = Atom.readable((get) => {
      const errors = get(crossFieldErrorsAtom)
      const error = errors.get(fieldPath)
      return error !== undefined ? Option.some(error) : Option.none<string>()
    }).pipe(Atom.setIdleTTL(0))

    const atoms: FieldAtoms = { valueAtom, initialValueAtom, touchedAtom, crossFieldErrorAtom }
    fieldAtomsRegistry.set(fieldPath, atoms)
    return atoms
  }

  const resetValidationAtoms = (registry: Registry.Registry) => {
    for (const validationAtom of validationAtomsRegistry.values()) {
      registry.set(validationAtom, Atom.Reset)
    }
    validationAtomsRegistry.clear()
    fieldAtomsRegistry.clear()
  }

  const decodeAndSubmit = runtime.fn<Form.EncodedFromFields<TFields>>()((values, get) =>
    Effect.gen(function*() {
      const decoded = yield* Schema.decodeUnknown(combinedSchema)(values) as Effect.Effect<
        Form.DecodedFromFields<TFields>,
        ParseResult.ParseError,
        R
      >
      const onSubmit = get(onSubmitAtom)!
      get.set(onSubmit, decoded)
      return yield* get.result(onSubmit, { suspendOnWaiting: true })
    })
  ).pipe(Atom.setIdleTTL(0)) as Atom.AtomResultFn<Form.EncodedFromFields<TFields>, unknown, unknown>

  const fieldRefs = Object.fromEntries(
    Object.keys(fields).map((key) => [key, makeFieldRef(key)]),
  ) as FieldRefs<TFields>

  const operations: FormOperations<TFields> = {
    createInitialState: (defaultValues) => ({
      values: defaultValues,
      initialValues: defaultValues,
      touched: createTouchedRecord(fields, false) as { readonly [K in keyof TFields]: boolean },
      submitCount: 0,
      dirtyFields: new Set(),
    }),

    createResetState: (state) => ({
      values: state.initialValues,
      initialValues: state.initialValues,
      touched: createTouchedRecord(fields, false) as { readonly [K in keyof TFields]: boolean },
      submitCount: 0,
      dirtyFields: new Set(),
    }),

    createSubmitState: (state) => ({
      ...state,
      touched: createTouchedRecord(fields, true) as { readonly [K in keyof TFields]: boolean },
      submitCount: state.submitCount + 1,
    }),

    setFieldValue: (state, fieldPath, value) => {
      const newValues = setNestedValue(state.values, fieldPath, value)
      const newDirtyFields = recalculateDirtySubtree(
        state.dirtyFields,
        state.initialValues,
        newValues,
        fieldPath,
      )
      return {
        ...state,
        values: newValues as Form.EncodedFromFields<TFields>,
        dirtyFields: newDirtyFields,
      }
    },

    setFormValues: (state, values) => {
      const newDirtyFields = recalculateDirtySubtree(
        state.dirtyFields,
        state.initialValues,
        values,
        "",
      )
      return {
        ...state,
        values,
        dirtyFields: newDirtyFields,
      }
    },

    setFieldTouched: (state, fieldPath, touched) => ({
      ...state,
      touched: setNestedValue(state.touched, fieldPath, touched) as { readonly [K in keyof TFields]: boolean },
    }),

    appendArrayItem: (state, arrayPath, itemSchema, value) => {
      const newItem = value ?? getDefaultFromSchema(itemSchema)
      const currentItems = (getNestedValue(state.values, arrayPath) ?? []) as ReadonlyArray<unknown>
      const newItems = [...currentItems, newItem]
      return {
        ...state,
        values: setNestedValue(state.values, arrayPath, newItems) as Form.EncodedFromFields<TFields>,
        dirtyFields: recalculateDirtyFieldsForArray(state.dirtyFields, state.initialValues, arrayPath, newItems),
      }
    },

    removeArrayItem: (state, arrayPath, index) => {
      const currentItems = (getNestedValue(state.values, arrayPath) ?? []) as ReadonlyArray<unknown>
      const newItems = currentItems.filter((_, i) => i !== index)
      return {
        ...state,
        values: setNestedValue(state.values, arrayPath, newItems) as Form.EncodedFromFields<TFields>,
        dirtyFields: recalculateDirtyFieldsForArray(state.dirtyFields, state.initialValues, arrayPath, newItems),
      }
    },

    swapArrayItems: (state, arrayPath, indexA, indexB) => {
      const currentItems = (getNestedValue(state.values, arrayPath) ?? []) as ReadonlyArray<unknown>
      if (
        indexA < 0 || indexA >= currentItems.length ||
        indexB < 0 || indexB >= currentItems.length ||
        indexA === indexB
      ) {
        return state
      }
      const newItems = [...currentItems]
      const temp = newItems[indexA]
      newItems[indexA] = newItems[indexB]
      newItems[indexB] = temp
      return {
        ...state,
        values: setNestedValue(state.values, arrayPath, newItems) as Form.EncodedFromFields<TFields>,
        dirtyFields: recalculateDirtyFieldsForArray(state.dirtyFields, state.initialValues, arrayPath, newItems),
      }
    },

    moveArrayItem: (state, arrayPath, fromIndex, toIndex) => {
      const currentItems = (getNestedValue(state.values, arrayPath) ?? []) as ReadonlyArray<unknown>
      if (
        fromIndex < 0 || fromIndex >= currentItems.length ||
        toIndex < 0 || toIndex > currentItems.length ||
        fromIndex === toIndex
      ) {
        return state
      }
      const newItems = [...currentItems]
      const [item] = newItems.splice(fromIndex, 1)
      newItems.splice(toIndex, 0, item)
      return {
        ...state,
        values: setNestedValue(state.values, arrayPath, newItems) as Form.EncodedFromFields<TFields>,
        dirtyFields: recalculateDirtyFieldsForArray(state.dirtyFields, state.initialValues, arrayPath, newItems),
      }
    },
  }

  return {
    stateAtom,
    crossFieldErrorsAtom,
    dirtyFieldsAtom,
    isDirtyAtom,
    submitCountAtom,
    onSubmitAtom,
    decodeAndSubmit,
    combinedSchema,
    fieldRefs,
    validationAtomsRegistry,
    fieldAtomsRegistry,
    getOrCreateValidationAtom,
    getOrCreateFieldAtoms,
    resetValidationAtoms,
    operations,
  } as FormAtoms<TFields, R>
}
