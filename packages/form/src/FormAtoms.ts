import * as Atom from "@effect-atom/atom/Atom"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import type * as ParseResult from "effect/ParseResult"
import * as Schema from "effect/Schema"
import * as Field from "./Field.js"
import * as FormBuilder from "./FormBuilder.js"
import { recalculateDirtyFieldsForArray, recalculateDirtySubtree } from "./internal/dirty.js"
import { createWeakRegistry, type WeakRegistry } from "./internal/weak-registry.js"
import { getNestedValue, isPathUnderRoot, setNestedValue } from "./Path.js"
import * as Validation from "./Validation.js"

/**
 * Atoms for a single field.
 *
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
 * @category Models
 */
export interface FormAtomsConfig<TFields extends Field.FieldsRecord, R, A, E, SubmitArgs = void> {
  readonly runtime: Atom.AtomRuntime<R, any>
  readonly formBuilder: FormBuilder.FormBuilder<TFields, R>
  readonly onSubmit: (
    args: SubmitArgs,
    ctx: {
      readonly decoded: Field.DecodedFromFields<TFields>
      readonly encoded: Field.EncodedFromFields<TFields>
      readonly get: Atom.FnContext
    },
  ) => A | Effect.Effect<A, E, R>
}

/**
 * Maps field names to their type-safe Field references for setValue operations.
 *
 * @category Models
 */
export type FieldRefs<TFields extends Field.FieldsRecord> = {
  readonly [K in keyof TFields]: TFields[K] extends Field.FieldDef<any, infer S> ?
    FormBuilder.FieldRef<Schema.Schema.Encoded<S>>
    : TFields[K] extends Field.ArrayFieldDef<any, infer S> ?
      FormBuilder.FieldRef<ReadonlyArray<Schema.Schema.Encoded<S>>>
    : never
}

/**
 * The complete form atoms infrastructure.
 *
 * @category Models
 */
export interface FormAtoms<TFields extends Field.FieldsRecord, R, A = void, E = never, SubmitArgs = void> {
  readonly stateAtom: Atom.Writable<
    Option.Option<FormBuilder.FormState<TFields>>,
    Option.Option<FormBuilder.FormState<TFields>>
  >
  readonly crossFieldErrorsAtom: Atom.Writable<Map<string, string>, Map<string, string>>
  readonly valuesAtom: Atom.Atom<Option.Option<Field.EncodedFromFields<TFields>>>
  readonly dirtyFieldsAtom: Atom.Atom<ReadonlySet<string>>
  readonly isDirtyAtom: Atom.Atom<boolean>
  readonly submitCountAtom: Atom.Atom<number>
  readonly lastSubmittedValuesAtom: Atom.Atom<Option.Option<FormBuilder.SubmittedValues<TFields>>>
  readonly changedSinceSubmitFieldsAtom: Atom.Atom<ReadonlySet<string>>
  readonly hasChangedSinceSubmitAtom: Atom.Atom<boolean>

  readonly submitAtom: Atom.AtomResultFn<SubmitArgs, A, E | ParseResult.ParseError>

  readonly combinedSchema: Schema.Schema<Field.DecodedFromFields<TFields>, Field.EncodedFromFields<TFields>, R>

  readonly fieldRefs: FieldRefs<TFields>

  readonly validationAtomsRegistry: WeakRegistry<Atom.AtomResultFn<unknown, void, ParseResult.ParseError>>
  readonly fieldAtomsRegistry: WeakRegistry<FieldAtoms>

  readonly getOrCreateValidationAtom: (
    fieldPath: string,
    schema: Schema.Schema.Any,
  ) => Atom.AtomResultFn<unknown, void, ParseResult.ParseError>

  readonly getOrCreateFieldAtoms: (fieldPath: string) => FieldAtoms

  readonly resetValidationAtoms: (ctx: { set: <R, W>(atom: Atom.Writable<R, W>, value: W) => void }) => void

  readonly operations: FormOperations<TFields>

  readonly resetAtom: Atom.Writable<void, void>
  readonly revertToLastSubmitAtom: Atom.Writable<void, void>
  readonly setValuesAtom: Atom.Writable<void, Field.EncodedFromFields<TFields>>
  readonly setValue: <S>(field: FormBuilder.FieldRef<S>) => Atom.Writable<void, S | ((prev: S) => S)>
}

/**
 * Pure state operations for form manipulation.
 *
 * @category Models
 */
export interface FormOperations<TFields extends Field.FieldsRecord> {
  readonly createInitialState: (defaultValues: Field.EncodedFromFields<TFields>) => FormBuilder.FormState<TFields>

  readonly createResetState: (state: FormBuilder.FormState<TFields>) => FormBuilder.FormState<TFields>

  readonly createSubmitState: (state: FormBuilder.FormState<TFields>) => FormBuilder.FormState<TFields>

  readonly setFieldValue: (
    state: FormBuilder.FormState<TFields>,
    fieldPath: string,
    value: unknown,
  ) => FormBuilder.FormState<TFields>

  readonly setFormValues: (
    state: FormBuilder.FormState<TFields>,
    values: Field.EncodedFromFields<TFields>,
  ) => FormBuilder.FormState<TFields>

  readonly setFieldTouched: (
    state: FormBuilder.FormState<TFields>,
    fieldPath: string,
    touched: boolean,
  ) => FormBuilder.FormState<TFields>

  readonly appendArrayItem: (
    state: FormBuilder.FormState<TFields>,
    arrayPath: string,
    itemSchema: Schema.Schema.Any,
    value?: unknown,
  ) => FormBuilder.FormState<TFields>

  readonly removeArrayItem: (
    state: FormBuilder.FormState<TFields>,
    arrayPath: string,
    index: number,
  ) => FormBuilder.FormState<TFields>

  readonly swapArrayItems: (
    state: FormBuilder.FormState<TFields>,
    arrayPath: string,
    indexA: number,
    indexB: number,
  ) => FormBuilder.FormState<TFields>

  readonly moveArrayItem: (
    state: FormBuilder.FormState<TFields>,
    arrayPath: string,
    fromIndex: number,
    toIndex: number,
  ) => FormBuilder.FormState<TFields>

  /**
   * Reverts values to the last submitted state.
   * No-op if form has never been submitted or is already in sync.
   */
  readonly revertToLastSubmit: (state: FormBuilder.FormState<TFields>) => FormBuilder.FormState<TFields>
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
 * const loginForm = FormBuilder.empty
 *   .addField(FormBuilder.makeField("email", Schema.String))
 *   .addField(FormBuilder.makeField("password", Schema.String))
 *
 * const atoms = FormAtoms.make({
 *   runtime,
 *   formBuilder: loginForm,
 *   parsedMode: { validation: "onChange", debounce: 300, autoSubmit: false }
 * })
 * ```
 *
 * @category Constructors
 */
export const make = <TFields extends Field.FieldsRecord, R, A, E, SubmitArgs = void>(
  config: FormAtomsConfig<TFields, R, A, E, SubmitArgs>,
): FormAtoms<TFields, R, A, E, SubmitArgs> => {
  const { formBuilder, runtime } = config
  const { fields } = formBuilder

  const combinedSchema = FormBuilder.buildSchema(formBuilder)

  const stateAtom = Atom.make(Option.none<FormBuilder.FormState<TFields>>()).pipe(Atom.setIdleTTL(0))
  const crossFieldErrorsAtom = Atom.make<Map<string, string>>(new Map()).pipe(Atom.setIdleTTL(0))

  const valuesAtom = Atom.readable((get) => Option.map(get(stateAtom), (state) => state.values)).pipe(
    Atom.setIdleTTL(0),
  )

  const dirtyFieldsAtom = Atom.readable((get) =>
    Option.match(get(stateAtom), {
      onNone: () => new Set<string>(),
      onSome: (state) => state.dirtyFields,
    })
  ).pipe(Atom.setIdleTTL(0))

  const isDirtyAtom = Atom.readable((get) =>
    Option.match(get(stateAtom), {
      onNone: () => false,
      onSome: (state) => state.dirtyFields.size > 0,
    })
  ).pipe(Atom.setIdleTTL(0))

  const submitCountAtom = Atom.readable((get) =>
    Option.match(get(stateAtom), {
      onNone: () => 0,
      onSome: (state) => state.submitCount,
    })
  ).pipe(Atom.setIdleTTL(0))

  const lastSubmittedValuesAtom = Atom.readable((get) =>
    Option.flatMap(get(stateAtom), (state) => state.lastSubmittedValues)
  ).pipe(Atom.setIdleTTL(0))

  const changedSinceSubmitFieldsAtom = Atom.readable((get) =>
    Option.match(get(stateAtom), {
      onNone: () => new Set<string>(),
      onSome: (state) =>
        Option.match(state.lastSubmittedValues, {
          onNone: () => new Set<string>(),
          onSome: (lastSubmitted) => recalculateDirtySubtree(new Set(), lastSubmitted.encoded, state.values, ""),
        }),
    })
  ).pipe(Atom.setIdleTTL(0))

  const hasChangedSinceSubmitAtom = Atom.readable((get) =>
    Option.match(get(stateAtom), {
      onNone: () => false,
      onSome: (state) => {
        if (Option.isNone(state.lastSubmittedValues)) return false
        if (state.values === state.lastSubmittedValues.value.encoded) return false
        return get(changedSinceSubmitFieldsAtom).size > 0
      },
    })
  ).pipe(Atom.setIdleTTL(0))

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
        ctx.set(stateAtom, Option.some(operations.setFieldValue(currentState, fieldPath, value)))
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

  const resetValidationAtoms = (ctx: { set: <R, W>(atom: Atom.Writable<R, W>, value: W) => void }) => {
    for (const validationAtom of validationAtomsRegistry.values()) {
      ctx.set(validationAtom, Atom.Reset)
    }
    validationAtomsRegistry.clear()
    fieldAtomsRegistry.clear()
  }

  const submitAtom = runtime.fn<SubmitArgs>()((args, get) =>
    Effect.gen(function*() {
      const state = get(stateAtom)
      if (Option.isNone(state)) return yield* Effect.die("Form not initialized")
      const values = state.value.values
      get.set(crossFieldErrorsAtom, new Map())
      const decoded = yield* pipe(
        Schema.decodeUnknown(combinedSchema)(values) as Effect.Effect<
          Field.DecodedFromFields<TFields>,
          ParseResult.ParseError,
          R
        >,
        Effect.tapError((parseError) =>
          Effect.sync(() => {
            const routedErrors = Validation.routeErrors(parseError)
            get.set(crossFieldErrorsAtom, routedErrors)
            get.set(stateAtom, Option.some(operations.createSubmitState(state.value)))
          })
        ),
      )
      const submitState = operations.createSubmitState(state.value)
      get.set(
        stateAtom,
        Option.some({
          ...submitState,
          lastSubmittedValues: Option.some({ encoded: values, decoded }),
        }),
      )
      const result = config.onSubmit(args, { decoded, encoded: values, get })
      if (Effect.isEffect(result)) {
        return yield* (result as Effect.Effect<A, E, R>)
      }
      return result as A
    })
  ).pipe(Atom.setIdleTTL(0)) as Atom.AtomResultFn<SubmitArgs, A, E | ParseResult.ParseError>

  const fieldRefs = Object.fromEntries(
    Object.keys(fields).map((key) => [key, FormBuilder.makeFieldRef(key)]),
  ) as FieldRefs<TFields>

  const operations: FormOperations<TFields> = {
    createInitialState: (defaultValues) => ({
      values: defaultValues,
      initialValues: defaultValues,
      lastSubmittedValues: Option.none(),
      touched: Field.createTouchedRecord(fields, false) as { readonly [K in keyof TFields]: boolean },
      submitCount: 0,
      dirtyFields: new Set(),
    }),

    createResetState: (state) => ({
      values: state.initialValues,
      initialValues: state.initialValues,
      lastSubmittedValues: Option.none(),
      touched: Field.createTouchedRecord(fields, false) as { readonly [K in keyof TFields]: boolean },
      submitCount: 0,
      dirtyFields: new Set(),
    }),

    createSubmitState: (state) => ({
      ...state,
      touched: Field.createTouchedRecord(fields, true) as { readonly [K in keyof TFields]: boolean },
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
        values: newValues as Field.EncodedFromFields<TFields>,
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
      const newItem = value ?? Field.getDefaultFromSchema(itemSchema)
      const currentItems = (getNestedValue(state.values, arrayPath) ?? []) as ReadonlyArray<unknown>
      const newItems = [...currentItems, newItem]
      return {
        ...state,
        values: setNestedValue(state.values, arrayPath, newItems) as Field.EncodedFromFields<TFields>,
        dirtyFields: recalculateDirtyFieldsForArray(state.dirtyFields, state.initialValues, arrayPath, newItems),
      }
    },

    removeArrayItem: (state, arrayPath, index) => {
      const currentItems = (getNestedValue(state.values, arrayPath) ?? []) as ReadonlyArray<unknown>
      const newItems = currentItems.filter((_, i) => i !== index)
      return {
        ...state,
        values: setNestedValue(state.values, arrayPath, newItems) as Field.EncodedFromFields<TFields>,
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
        values: setNestedValue(state.values, arrayPath, newItems) as Field.EncodedFromFields<TFields>,
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
        values: setNestedValue(state.values, arrayPath, newItems) as Field.EncodedFromFields<TFields>,
        dirtyFields: recalculateDirtyFieldsForArray(state.dirtyFields, state.initialValues, arrayPath, newItems),
      }
    },

    revertToLastSubmit: (state) => {
      if (Option.isNone(state.lastSubmittedValues)) {
        return state
      }

      const lastEncoded = state.lastSubmittedValues.value.encoded
      if (state.values === lastEncoded) {
        return state
      }

      const newDirtyFields = recalculateDirtySubtree(
        state.dirtyFields,
        state.initialValues,
        lastEncoded,
        "",
      )

      return {
        ...state,
        values: lastEncoded,
        dirtyFields: newDirtyFields,
      }
    },
  }

  const resetAtom = Atom.fnSync<void>()((_: void, get) => {
    const state = get(stateAtom)
    if (Option.isNone(state)) return
    get.set(stateAtom, Option.some(operations.createResetState(state.value)))
    get.set(crossFieldErrorsAtom, new Map())
    resetValidationAtoms(get)
    get.set(submitAtom, Atom.Reset)
  }, { initialValue: undefined as void }).pipe(Atom.setIdleTTL(0))

  const revertToLastSubmitAtom = Atom.fnSync<void>()((_: void, get) => {
    const state = get(stateAtom)
    if (Option.isNone(state)) return
    get.set(stateAtom, Option.some(operations.revertToLastSubmit(state.value)))
    get.set(crossFieldErrorsAtom, new Map())
  }, { initialValue: undefined as void }).pipe(Atom.setIdleTTL(0))

  const setValuesAtom = Atom.fnSync<Field.EncodedFromFields<TFields>>()((_values, get) => {
    const state = get(stateAtom)
    if (Option.isNone(state)) return
    get.set(stateAtom, Option.some(operations.setFormValues(state.value, _values)))
    get.set(crossFieldErrorsAtom, new Map())
  }, { initialValue: undefined as void }).pipe(Atom.setIdleTTL(0))

  const setValueAtomsRegistry = createWeakRegistry<Atom.Writable<void, any>>()

  const setValue = <S>(field: FormBuilder.FieldRef<S>): Atom.Writable<void, S | ((prev: S) => S)> => {
    const cached = setValueAtomsRegistry.get(field.key)
    if (cached) return cached

    const atom = Atom.fnSync<S | ((prev: S) => S)>()((update, get) => {
      const state = get(stateAtom)
      if (Option.isNone(state)) return

      const currentValue = getNestedValue(state.value.values, field.key) as S
      const newValue = typeof update === "function"
        ? (update as (prev: S) => S)(currentValue)
        : update

      get.set(stateAtom, Option.some(operations.setFieldValue(state.value, field.key, newValue)))

      const currentErrors = get(crossFieldErrorsAtom)
      const nextErrors = new Map<string, string>()
      for (const [errorPath, message] of currentErrors) {
        if (!isPathUnderRoot(errorPath, field.key)) {
          nextErrors.set(errorPath, message)
        }
      }
      if (nextErrors.size !== currentErrors.size) {
        get.set(crossFieldErrorsAtom, nextErrors)
      }
    }, { initialValue: undefined as void }).pipe(Atom.setIdleTTL(0))

    setValueAtomsRegistry.set(field.key, atom)
    return atom
  }

  return {
    stateAtom,
    crossFieldErrorsAtom,
    valuesAtom,
    dirtyFieldsAtom,
    isDirtyAtom,
    submitCountAtom,
    lastSubmittedValuesAtom,
    changedSinceSubmitFieldsAtom,
    hasChangedSinceSubmitAtom,
    submitAtom,
    combinedSchema,
    fieldRefs,
    validationAtomsRegistry,
    fieldAtomsRegistry,
    getOrCreateValidationAtom,
    getOrCreateFieldAtoms,
    resetValidationAtoms,
    operations,
    resetAtom,
    revertToLastSubmitAtom,
    setValuesAtom,
    setValue,
  } as FormAtoms<TFields, R, A, E, SubmitArgs>
}
