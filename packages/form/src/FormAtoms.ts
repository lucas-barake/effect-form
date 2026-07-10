import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as Atom from "effect/unstable/reactivity/Atom"
import * as Field from "./Field.ts"
import * as FormBuilder from "./FormBuilder.ts"
import { recalculateDirtyFieldsForArray, recalculateDirtySubtree } from "./internal/dirty.ts"
import { createWeakRegistry, type WeakRegistry } from "./internal/weak-registry.ts"
import * as Mode from "./Mode.ts"
import { getNestedValue, isPathOrParentDirty, setNestedValue } from "./Path.ts"
import * as Validation from "./Validation.ts"

export interface FieldAtoms {
  readonly valueAtom: Atom.Writable<unknown, unknown>
  readonly initialValueAtom: Atom.Atom<unknown>
  readonly touchedAtom: Atom.Writable<boolean, boolean>
  readonly errorAtom: Atom.Atom<Option.Option<Validation.ErrorEntry>>
  readonly isDirtyAtom: Atom.Atom<boolean>
  readonly validationAtom: Atom.AtomResultFn<unknown, void, Schema.SchemaError>
  readonly displayErrorAtom: Atom.Atom<Option.Option<string>>
  readonly fieldValidationCountAtom: Atom.Writable<number, number>
  readonly shouldValidateAtom: Atom.Atom<boolean>
  readonly triggerValidationAtom: Atom.Atom<void>
}

export interface PublicFieldAtoms<E,> {
  readonly value: Atom.Atom<Option.Option<E>>
  readonly error: Atom.Atom<Option.Option<string>>
  readonly isDirty: Atom.Atom<boolean>
  readonly isTouched: Atom.Atom<boolean>
  readonly isValidating: Atom.Atom<boolean>
  readonly setValue: Atom.Writable<void, E | ((prev: E) => E)>
  readonly setTouched: Atom.Writable<void, boolean>
  readonly validate: Atom.Writable<void, void>
}

export interface FormAtomsConfig<TFields extends Field.FieldsRecord, R, A, E, SubmitArgs = void,> {
  readonly runtime: Atom.AtomRuntime<R, any>
  readonly formBuilder: FormBuilder.FormBuilder<TFields, R>
  readonly mode?: Mode.FormMode
  readonly reactivityKeys?: ReadonlyArray<unknown> | Readonly<Record<string, ReadonlyArray<unknown>>> | undefined
  readonly onSubmit: (
    args: SubmitArgs,
    ctx: {
      readonly decoded: Field.DecodedFromFields<TFields>
      readonly encoded: Field.EncodedFromFields<TFields>
      readonly get: Atom.FnContext
    }
  ) => A | Effect.Effect<A, E, R>
}

export type FieldRefs<TFields extends Field.FieldsRecord,> = {
  readonly [K in keyof TFields]: TFields[K] extends Field.FieldDef<any, infer S>
    ? FormBuilder.FieldRef<Schema.Codec.Encoded<S>>
    : TFields[K] extends Field.ArrayFieldDef<any, infer S>
      ? FormBuilder.FieldRef<ReadonlyArray<Schema.Codec.Encoded<S>>>
    : never
}

export interface FormAtoms<TFields extends Field.FieldsRecord, R, A = void, E = never, SubmitArgs = void,> {
  readonly stateAtom: Atom.Writable<
    Option.Option<FormBuilder.FormState<TFields>>,
    Option.Option<FormBuilder.FormState<TFields>>
  >
  readonly errorsAtom: Atom.Writable<Map<string, Validation.ErrorEntry>, Map<string, Validation.ErrorEntry>>
  readonly rootErrorAtom: Atom.Atom<Option.Option<string>>
  readonly valuesAtom: Atom.Atom<Option.Option<Field.EncodedFromFields<TFields>>>
  readonly dirtyFieldsAtom: Atom.Atom<ReadonlySet<string>>
  readonly isDirtyAtom: Atom.Atom<boolean>
  readonly submitCountAtom: Atom.Atom<number>
  readonly validationCountAtom: Atom.Atom<number>
  readonly lastSubmittedValuesAtom: Atom.Atom<Option.Option<FormBuilder.SubmittedValues<TFields>>>
  readonly changedSinceSubmitFieldsAtom: Atom.Atom<ReadonlySet<string>>
  readonly hasChangedSinceSubmitAtom: Atom.Atom<boolean>

  readonly submitAtom: Atom.AtomResultFn<SubmitArgs, A, E | Schema.SchemaError>
  readonly validateAtom: Atom.AtomResultFn<void, void, never>

  readonly combinedSchema: Schema.Codec<Field.DecodedFromFields<TFields>, Field.EncodedFromFields<TFields>, R>

  readonly fieldRefs: FieldRefs<TFields>

  readonly validationAtomsRegistry: WeakRegistry<Atom.AtomResultFn<unknown, void, Schema.SchemaError>>
  readonly fieldAtomsRegistry: WeakRegistry<FieldAtoms>

  readonly getOrCreateValidationAtom: (
    fieldPath: string,
    schema: Schema.Top
  ) => Atom.AtomResultFn<unknown, void, Schema.SchemaError>

  readonly getOrCreateFieldAtoms: (fieldPath: string, schema: Schema.Top) => FieldAtoms

  readonly resetValidationAtoms: (ctx: { set: <R, W,>(atom: Atom.Writable<R, W>, value: W) => void }) => void

  readonly operations: FormOperations<TFields>

  readonly resetAtom: Atom.Writable<void, void>
  readonly revertToLastSubmitAtom: Atom.Writable<void, void>
  readonly setValuesAtom: Atom.Writable<Field.EncodedFromFields<TFields>>

  readonly getFieldAtoms: <S,>(field: FormBuilder.FieldRef<S>) => PublicFieldAtoms<S>

  /**
   * Root anchor atom for the form's dependency graph.
   * Mount this atom to keep all form state alive even when field components unmount.
   *
   * Useful for:
   * - Multi-step wizards where steps unmount but state should persist
   * - Conditional fields (toggles) where state should survive visibility changes
   *
   * @example
   * ```tsx
   * // Keep form state alive at wizard root level
   * function Wizard() {
   *   useAtomMount(step1Form.mount)
   *   useAtomMount(step2Form.mount)
   *   return currentStep === 1 ? <Step1 /> : <Step2 />
   * }
   * ```
   */
  readonly autoSubmitAtom: Atom.Atom<void>
  readonly onBlurSubmitAtom: Atom.Writable<void, void>

  readonly mountAtom: Atom.Atom<void>

  readonly keepAliveActiveAtom: Atom.Writable<boolean, boolean>
}

export interface FormOperations<TFields extends Field.FieldsRecord,> {
  readonly createInitialState: (defaultValues: Field.EncodedFromFields<TFields>) => FormBuilder.FormState<TFields>

  readonly createResetState: (state: FormBuilder.FormState<TFields>) => FormBuilder.FormState<TFields>

  readonly createSubmitState: (state: FormBuilder.FormState<TFields>) => FormBuilder.FormState<TFields>

  readonly setFieldValue: (
    state: FormBuilder.FormState<TFields>,
    fieldPath: string,
    value: unknown
  ) => FormBuilder.FormState<TFields>

  readonly setFormValues: (
    state: FormBuilder.FormState<TFields>,
    values: Field.EncodedFromFields<TFields>
  ) => FormBuilder.FormState<TFields>

  readonly setFieldTouched: (
    state: FormBuilder.FormState<TFields>,
    fieldPath: string,
    touched: boolean
  ) => FormBuilder.FormState<TFields>

  readonly appendArrayItem: (
    state: FormBuilder.FormState<TFields>,
    arrayPath: string,
    itemSchema: Schema.Top,
    value?: unknown
  ) => FormBuilder.FormState<TFields>

  readonly removeArrayItem: (
    state: FormBuilder.FormState<TFields>,
    arrayPath: string,
    index: number
  ) => FormBuilder.FormState<TFields>

  readonly swapArrayItems: (
    state: FormBuilder.FormState<TFields>,
    arrayPath: string,
    indexA: number,
    indexB: number
  ) => FormBuilder.FormState<TFields>

  readonly moveArrayItem: (
    state: FormBuilder.FormState<TFields>,
    arrayPath: string,
    fromIndex: number,
    toIndex: number
  ) => FormBuilder.FormState<TFields>

  readonly revertToLastSubmit: (state: FormBuilder.FormState<TFields>) => FormBuilder.FormState<TFields>
}

export const make = <TFields extends Field.FieldsRecord, R, A, E, SubmitArgs = void,>(
  config: FormAtomsConfig<TFields, R, A, E, SubmitArgs>
): FormAtoms<TFields, R, A, E, SubmitArgs> => {
  const { formBuilder, runtime } = config
  const { fields } = formBuilder
  const parsedMode = Mode.parse(config.mode)

  const combinedSchema = FormBuilder.buildSchema(formBuilder)

  const stateAtom = Atom.make(Option.none<FormBuilder.FormState<TFields>>()).pipe(Atom.setIdleTTL(0))
  const errorsAtom = Atom.make<Map<string, Validation.ErrorEntry>>(new Map()).pipe(Atom.setIdleTTL(0))

  const rootErrorAtom = Atom.readable((get) => {
    const errors = get(errorsAtom)
    const entry = errors.get("")
    return entry ? Option.some(entry.message) : Option.none<string>()
  }).pipe(Atom.setIdleTTL(0))

  const valuesAtom = Atom.readable((get) => Option.map(get(stateAtom), (state) => state.values)).pipe(
    Atom.setIdleTTL(0)
  )

  const dirtyFieldsAtom = Atom.readable((get) =>
    Option.match(get(stateAtom), {
      onNone: () => new Set<string>(),
      onSome: (state) => state.dirtyFields
    })
  ).pipe(Atom.setIdleTTL(0))

  const isDirtyAtom = Atom.readable((get) =>
    Option.match(get(stateAtom), {
      onNone: () => false,
      onSome: (state) => state.dirtyFields.size > 0
    })
  ).pipe(Atom.setIdleTTL(0))

  const submitCountAtom = Atom.readable((get) =>
    Option.match(get(stateAtom), {
      onNone: () => 0,
      onSome: (state) => state.submitCount
    })
  ).pipe(Atom.setIdleTTL(0))

  const validationCountAtom = Atom.readable((get) =>
    Option.match(get(stateAtom), {
      onNone: () => 0,
      onSome: (state) => state.validationCount
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
          onSome: (lastSubmitted) => recalculateDirtySubtree(new Set(), lastSubmitted.encoded, state.values, "")
        })
    })
  ).pipe(Atom.setIdleTTL(0))

  const hasChangedSinceSubmitAtom = Atom.readable((get) =>
    Option.match(get(stateAtom), {
      onNone: () => false,
      onSome: (state) => {
        if (Option.isNone(state.lastSubmittedValues)) return false
        if (state.values === state.lastSubmittedValues.value.encoded) return false
        return get(changedSinceSubmitFieldsAtom).size > 0
      }
    })
  ).pipe(Atom.setIdleTTL(0))

  const validationAtomsRegistry = createWeakRegistry<Atom.AtomResultFn<unknown, void, Schema.SchemaError>>()
  const fieldAtomsRegistry = createWeakRegistry<FieldAtoms>()
  const publicFieldAtomsRegistry = createWeakRegistry<PublicFieldAtoms<unknown>>()
  const validationSchemaRegistry = new Map<string, Schema.Top>()
  const fieldSchemaRegistry = new Map<string, Schema.Top>()
  const isDirtyAtomsRegistry = createWeakRegistry<Atom.Atom<boolean>>()

  const fieldSchemasByKey = new Map<string, Schema.Top>()
  for (const [key, def] of Object.entries(fields)) {
    if (Field.isArrayFieldDef(def)) {
      fieldSchemasByKey.set(key, Schema.Array(def.itemSchema))
    } else if (Field.isFieldDef(def)) {
      fieldSchemasByKey.set(key, def.schema)
    }
  }

  const getOrCreateValidationAtom = (
    fieldPath: string,
    schema: Schema.Top
  ): Atom.AtomResultFn<unknown, void, Schema.SchemaError> => {
    const existing = validationAtomsRegistry.get(fieldPath)
    const existingSchema = validationSchemaRegistry.get(fieldPath)
    if (existing && existingSchema === schema) return existing

    const validationAtom = runtime
      .fn<unknown>()((value: unknown) =>
        pipe(Schema.decodeUnknownEffect(schema)(value) as Effect.Effect<unknown, Schema.SchemaError, R>, Effect.asVoid)
      )
      .pipe(Atom.setIdleTTL(0)) as Atom.AtomResultFn<unknown, void, Schema.SchemaError>

    validationAtomsRegistry.set(fieldPath, validationAtom)
    validationSchemaRegistry.set(fieldPath, schema)
    return validationAtom
  }

  const getOrCreateFieldAtoms = (fieldPath: string, schema: Schema.Top): FieldAtoms => {
    const existing = fieldAtomsRegistry.get(fieldPath)
    const existingSchema = fieldSchemaRegistry.get(fieldPath)
    if (existing && existingSchema === schema) return existing

    const valueAtom = Atom.writable(
      (get) => getNestedValue(Option.getOrThrow(get(stateAtom)).values, fieldPath),
      (ctx, value) => {
        const currentState = Option.getOrThrow(ctx.get(stateAtom))
        ctx.set(stateAtom, Option.some(operations.setFieldValue(currentState, fieldPath, value)))
      }
    ).pipe(Atom.setIdleTTL(0))

    const initialValueAtom = Atom.readable((get) =>
      getNestedValue(Option.getOrThrow(get(stateAtom)).initialValues, fieldPath)
    ).pipe(Atom.setIdleTTL(0))

    const touchedAtom = Atom.writable(
      (get) => (getNestedValue(Option.getOrThrow(get(stateAtom)).touched, fieldPath) ?? false) as boolean,
      (ctx, value) => {
        const currentState = Option.getOrThrow(ctx.get(stateAtom))
        ctx.set(
          stateAtom,
          Option.some({
            ...currentState,
            touched: setNestedValue(currentState.touched, fieldPath, value)
          })
        )
      }
    ).pipe(Atom.setIdleTTL(0))

    const errorAtom = Atom.readable((get) => {
      const errors = get(errorsAtom)
      const entry = errors.get(fieldPath)
      return entry ? Option.some(entry) : Option.none<Validation.ErrorEntry>()
    }).pipe(Atom.setIdleTTL(0))

    const existingIsDirtyAtom = isDirtyAtomsRegistry.get(fieldPath)
    const isDirtyAtom = existingIsDirtyAtom ?? Atom.readable((get) =>
      isPathOrParentDirty(
        Option.match(get(stateAtom), {
          onNone: () => new Set<string>(),
          onSome: (state) => state.dirtyFields
        }),
        fieldPath
      )
    ).pipe(Atom.setIdleTTL(0))
    if (!existingIsDirtyAtom) {
      isDirtyAtomsRegistry.set(fieldPath, isDirtyAtom)
    }

    const validationAtom = getOrCreateValidationAtom(fieldPath, schema)

    const fieldValidationCountAtom = Atom.make(0).pipe(Atom.setIdleTTL(0))

    const shouldValidateAtom = Atom.readable((get) => {
      if (parsedMode.validation === "onChange") return true
      if (parsedMode.validation === "onBlur") return get(touchedAtom) || get(fieldValidationCountAtom) > 0
      return get(submitCountAtom) > 0 || get(validationCountAtom) > 0 || get(fieldValidationCountAtom) > 0
    }).pipe(Atom.setIdleTTL(0))

    const displayErrorAtom = Atom.readable((get) => {
      const validationResult = get(validationAtom)
      const storedError = get(errorAtom)
      const isDirty = get(isDirtyAtom)
      const isTouched = get(touchedAtom)
      const submitCount = get(submitCountAtom)

      let livePerFieldError: Option.Option<string> = Option.none()
      if (validationResult._tag === "Failure") {
        const parseError = Cause.findErrorOption(validationResult.cause)
        if (Option.isSome(parseError) && Schema.isSchemaError(parseError.value)) {
          livePerFieldError = Validation.extractFirstError(parseError.value)
        }
      }

      let validationError: Option.Option<string> = Option.none()
      if (Option.isSome(livePerFieldError)) {
        validationError = livePerFieldError
      } else if (Option.isSome(storedError)) {
        const isValidating = validationResult.waiting
        const shouldHideStoredError = storedError.value.source === "field" &&
          (validationResult._tag === "Success" || isValidating)
        if (!shouldHideStoredError) {
          validationError = Option.some(storedError.value.message)
        }
      }

      const validationCount = get(validationCountAtom)
      const fieldValidationCount = get(fieldValidationCountAtom)
      const hasAttemptedValidation = submitCount > 0 || validationCount > 0 || fieldValidationCount > 0
      const shouldShowError = parsedMode.validation === "onChange"
        ? isDirty || hasAttemptedValidation
        : parsedMode.validation === "onBlur"
        ? isTouched || hasAttemptedValidation
        : hasAttemptedValidation

      return shouldShowError ? validationError : Option.none()
    }).pipe(Atom.setIdleTTL(0))

    const triggerValidationAtom = Atom.readable((get) => {
      let lastValue = get.once(valueAtom)
      let timeout: ReturnType<typeof setTimeout> | undefined

      const shouldDebounce = parsedMode.validation === "onChange" &&
        parsedMode.debounce !== null && !parsedMode.autoSubmit
      const debounceMs = shouldDebounce ? parsedMode.debounce : null

      const trigger = (value: unknown) => {
        if (!get.once(shouldValidateAtom)) return
        if (debounceMs !== null && debounceMs > 0) {
          if (timeout !== undefined) clearTimeout(timeout)
          timeout = setTimeout(() => {
            timeout = undefined
            get.set(validationAtom, value)
          }, debounceMs)
        } else {
          get.set(validationAtom, value)
        }
      }

      get.addFinalizer(() => {
        if (timeout !== undefined) clearTimeout(timeout)
      })

      get.subscribe(valueAtom, (newValue) => {
        if (newValue === lastValue) return
        lastValue = newValue
        trigger(newValue)
      })

      if (parsedMode.validation === "onBlur") {
        get.subscribe(touchedAtom, (isTouched) => {
          if (isTouched) {
            const currentValue = get.once(valueAtom)
            get.set(validationAtom, currentValue)
          }
        })
      }
    }).pipe(Atom.setIdleTTL(0))

    const atoms: FieldAtoms = {
      valueAtom,
      initialValueAtom,
      touchedAtom,
      errorAtom,
      isDirtyAtom,
      validationAtom,
      fieldValidationCountAtom,
      displayErrorAtom,
      shouldValidateAtom,
      triggerValidationAtom
    }
    fieldAtomsRegistry.set(fieldPath, atoms)
    fieldSchemaRegistry.set(fieldPath, schema)
    return atoms
  }

  const resetValidationAtoms = (ctx: { set: <R, W,>(atom: Atom.Writable<R, W>, value: W) => void }) => {
    for (const validationAtom of validationAtomsRegistry.values()) {
      ctx.set(validationAtom, Atom.Reset)
    }
    for (const fieldAtoms of fieldAtomsRegistry.values()) {
      ctx.set(fieldAtoms.fieldValidationCountAtom, 0)
    }
  }

  const submitAtom = runtime
    .fn<SubmitArgs>()(
      (args, get) =>
        Effect.gen(function*() {
          const state = get(stateAtom)
          if (Option.isNone(state)) return yield* Effect.die("Form not initialized")
          const values = state.value.values
          get.set(errorsAtom, new Map())
          const decoded = yield* pipe(
            Schema.decodeUnknownEffect(combinedSchema)(values, { errors: "all" }) as Effect.Effect<
              Field.DecodedFromFields<TFields>,
              Schema.SchemaError,
              R
            >,
            Effect.tapError((parseError) =>
              Effect.sync(() => {
                const routedErrors = Validation.routeErrorsWithSource(parseError)
                get.set(errorsAtom, routedErrors)
                // Rebase onto the latest state so edits made during the in-flight
                // async decode are preserved instead of clobbered by the snapshot.
                const latest = get(stateAtom)
                const base = Option.isSome(latest) ? latest.value : state.value
                get.set(stateAtom, Option.some(operations.createSubmitState(base)))
              })
            )
          )
          // Rebase onto the latest state so a field edit made while the async
          // decode was running is not silently reverted to the pre-submit snapshot.
          const latestState = get(stateAtom)
          const baseState = Option.isSome(latestState) ? latestState.value : state.value
          const submitState = operations.createSubmitState(baseState)
          get.set(stateAtom, Option.some(submitState))
          const result = config.onSubmit(args, { decoded, encoded: values, get })
          const output = Effect.isEffect(result)
            ? yield* (result as Effect.Effect<A, E, R>)
            : (result as A)
          // Only record the values as "last submitted" once onSubmit has
          // succeeded. A failed onSubmit must not be reported as a successful
          // submit, otherwise revertToLastSubmit / hasChangedSinceSubmit would
          // treat unsaved, failed values as persisted.
          const afterSubmit = get(stateAtom)
          if (Option.isSome(afterSubmit)) {
            get.set(
              stateAtom,
              Option.some({
                ...afterSubmit.value,
                lastSubmittedValues: Option.some({ encoded: values, decoded })
              })
            )
          }
          return output
        }),
      config.reactivityKeys ? { reactivityKeys: config.reactivityKeys } : undefined
    )
    .pipe(Atom.setIdleTTL(0)) as Atom.AtomResultFn<SubmitArgs, A, E | Schema.SchemaError>

  const validateAtom = runtime
    .fn<void>()(
      (_: void, get) =>
        Effect.gen(function*() {
          const state = get(stateAtom)
          if (Option.isNone(state)) return
          const values = state.value.values
          get.set(errorsAtom, new Map())
          yield* pipe(
            Schema.decodeUnknownEffect(combinedSchema)(values, { errors: "all" }) as Effect.Effect<
              Field.DecodedFromFields<TFields>,
              Schema.SchemaError,
              R
            >,
            Effect.catchTag("SchemaError", (parseError) =>
              Effect.sync(() => {
                const routedErrors = Validation.routeErrorsWithSource(parseError)
                get.set(errorsAtom, routedErrors)
              }))
          )
          const currentState = get(stateAtom)
          if (Option.isSome(currentState)) {
            get.set(
              stateAtom,
              Option.some({
                ...currentState.value,
                validationCount: currentState.value.validationCount + 1
              })
            )
          }
        })
    )
    .pipe(Atom.setIdleTTL(0)) as Atom.AtomResultFn<void, void, never>

  const fieldRefs = Object.fromEntries(
    Object.keys(fields).map((key) => [key, FormBuilder.makeFieldRef(key)])
  ) as FieldRefs<TFields>

  const operations: FormOperations<TFields> = {
    createInitialState: (defaultValues) => ({
      values: defaultValues,
      initialValues: defaultValues,
      lastSubmittedValues: Option.none(),
      touched: Field.createTouchedRecord(fields, false) as { readonly [K in keyof TFields]: boolean },
      submitCount: 0,
      validationCount: 0,
      dirtyFields: new Set()
    }),

    createResetState: (state) => ({
      values: state.initialValues,
      initialValues: state.initialValues,
      lastSubmittedValues: Option.none(),
      touched: Field.createTouchedRecord(fields, false) as { readonly [K in keyof TFields]: boolean },
      submitCount: 0,
      validationCount: 0,
      dirtyFields: new Set()
    }),

    createSubmitState: (state) => ({
      ...state,
      touched: Field.createTouchedRecord(fields, true) as { readonly [K in keyof TFields]: boolean },
      submitCount: state.submitCount + 1
    }),

    setFieldValue: (state, fieldPath, value) => {
      const newValues = setNestedValue(state.values, fieldPath, value)
      const newDirtyFields = recalculateDirtySubtree(state.dirtyFields, state.initialValues, newValues, fieldPath)
      return {
        ...state,
        values: newValues as Field.EncodedFromFields<TFields>,
        dirtyFields: newDirtyFields
      }
    },

    setFormValues: (state, values) => {
      const newDirtyFields = recalculateDirtySubtree(state.dirtyFields, state.initialValues, values, "")
      return {
        ...state,
        values,
        dirtyFields: newDirtyFields
      }
    },

    setFieldTouched: (state, fieldPath, touched) => ({
      ...state,
      touched: setNestedValue(state.touched, fieldPath, touched) as { readonly [K in keyof TFields]: boolean }
    }),

    appendArrayItem: (state, arrayPath, itemSchema, value) => {
      const newItem = value ?? Field.getDefaultFromSchema(itemSchema)
      const currentItems = (getNestedValue(state.values, arrayPath) ?? []) as ReadonlyArray<unknown>
      const newItems = [...currentItems, newItem]
      return {
        ...state,
        values: setNestedValue(state.values, arrayPath, newItems) as Field.EncodedFromFields<TFields>,
        dirtyFields: recalculateDirtyFieldsForArray(state.dirtyFields, state.initialValues, arrayPath, newItems)
      }
    },

    removeArrayItem: (state, arrayPath, index) => {
      const currentItems = (getNestedValue(state.values, arrayPath) ?? []) as ReadonlyArray<unknown>
      const newItems = currentItems.filter((_, i) => i !== index)
      return {
        ...state,
        values: setNestedValue(state.values, arrayPath, newItems) as Field.EncodedFromFields<TFields>,
        dirtyFields: recalculateDirtyFieldsForArray(state.dirtyFields, state.initialValues, arrayPath, newItems)
      }
    },

    swapArrayItems: (state, arrayPath, indexA, indexB) => {
      const currentItems = (getNestedValue(state.values, arrayPath) ?? []) as ReadonlyArray<unknown>
      if (
        indexA < 0 ||
        indexA >= currentItems.length ||
        indexB < 0 ||
        indexB >= currentItems.length ||
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
        dirtyFields: recalculateDirtyFieldsForArray(state.dirtyFields, state.initialValues, arrayPath, newItems)
      }
    },

    moveArrayItem: (state, arrayPath, fromIndex, toIndex) => {
      const currentItems = (getNestedValue(state.values, arrayPath) ?? []) as ReadonlyArray<unknown>
      if (
        fromIndex < 0 ||
        fromIndex >= currentItems.length ||
        toIndex < 0 ||
        toIndex > currentItems.length ||
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
        dirtyFields: recalculateDirtyFieldsForArray(state.dirtyFields, state.initialValues, arrayPath, newItems)
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

      const newDirtyFields = recalculateDirtySubtree(state.dirtyFields, state.initialValues, lastEncoded, "")

      return {
        ...state,
        values: lastEncoded,
        dirtyFields: newDirtyFields
      }
    }
  }

  const resetAtom = Atom.fnSync<void>()(
    (_: void, get) => {
      const state = get(stateAtom)
      if (Option.isNone(state)) return
      get.set(stateAtom, Option.some(operations.createResetState(state.value)))
      get.set(errorsAtom, new Map())
      resetValidationAtoms(get)
      get.set(submitAtom, Atom.Reset)
      get.set(validateAtom, Atom.Reset)
    },
    { initialValue: undefined as void }
  ).pipe(Atom.setIdleTTL(0))

  const revertToLastSubmitAtom = Atom.fnSync<void>()(
    (_: void, get) => {
      const state = get(stateAtom)
      if (Option.isNone(state)) return
      get.set(stateAtom, Option.some(operations.revertToLastSubmit(state.value)))
      get.set(errorsAtom, new Map())
    },
    { initialValue: undefined as void }
  ).pipe(Atom.setIdleTTL(0))

  const setValuesAtom = Atom.writable(
    (get): Field.EncodedFromFields<TFields> =>
      pipe(
        get(stateAtom),
        Option.map((s) => s.values),
        Option.getOrElse(() => undefined as never)
      ),
    (ctx, values: Field.EncodedFromFields<TFields>) => {
      const state = ctx.get(stateAtom)
      if (Option.isNone(state)) return
      ctx.set(stateAtom, Option.some(operations.setFormValues(state.value, values)))
      ctx.set(errorsAtom, new Map())
    }
  ).pipe(Atom.setIdleTTL(0))

  const setValueAtomsRegistry = createWeakRegistry<Atom.Writable<void, any>>()

  const setValue = <S,>(field: FormBuilder.FieldRef<S>): Atom.Writable<void, S | ((prev: S) => S)> => {
    const cached = setValueAtomsRegistry.get(field.key)
    if (cached) return cached

    const atom = Atom.fnSync<S | ((prev: S) => S)>()(
      (update, get) => {
        const state = get(stateAtom)
        if (Option.isNone(state)) return

        const currentValue = getNestedValue(state.value.values, field.key) as S
        const newValue = typeof update === "function" ? (update as (prev: S) => S)(currentValue) : update

        get.set(stateAtom, Option.some(operations.setFieldValue(state.value, field.key, newValue)))
        // Don't clear errors - display logic handles showing/hiding based on source + validation state
      },
      { initialValue: undefined as void }
    ).pipe(Atom.setIdleTTL(0))

    setValueAtomsRegistry.set(field.key, atom)
    return atom
  }

  const getFieldIsDirty = (field: FormBuilder.FieldRef<any>): Atom.Atom<boolean> => {
    const cached = fieldAtomsRegistry.get(field.key)
    if (cached) return cached.isDirtyAtom

    const existing = isDirtyAtomsRegistry.get(field.key)
    if (existing) return existing

    const atom = Atom.readable((get) =>
      isPathOrParentDirty(
        Option.match(get(stateAtom), {
          onNone: () => new Set<string>(),
          onSome: (state) => state.dirtyFields
        }),
        field.key
      )
    ).pipe(Atom.setIdleTTL(0))

    isDirtyAtomsRegistry.set(field.key, atom)
    return atom
  }

  const getFieldAtoms = <S,>(field: FormBuilder.FieldRef<S>): PublicFieldAtoms<S> => {
    const cached = publicFieldAtomsRegistry.get(field.key)
    if (cached) return cached as PublicFieldAtoms<S>

    const schema = fieldSchemasByKey.get(field.key)
    if (!schema) throw new Error(`No schema found for field "${field.key}"`)

    const internal = getOrCreateFieldAtoms(field.key, schema)

    const value = Atom.readable((get) =>
      Option.map(get(stateAtom), (state) => getNestedValue(state.values, field.key) as S)
    ).pipe(Atom.setIdleTTL(0))

    const error = Atom.readable((get) =>
      Option.match(get(stateAtom), {
        onNone: () => Option.none<string>(),
        onSome: () => get(internal.displayErrorAtom)
      })
    ).pipe(Atom.setIdleTTL(0))

    const isDirty = getFieldIsDirty(field)

    const isTouched = Atom.readable((get) =>
      Option.match(get(stateAtom), {
        onNone: () => false,
        onSome: (state) => (getNestedValue(state.touched, field.key) ?? false) as boolean
      })
    ).pipe(Atom.setIdleTTL(0))

    const isValidating = Atom.readable((get) => get(internal.validationAtom).waiting).pipe(Atom.setIdleTTL(0))

    const setValueAtom = setValue(field)

    const setTouchedAtom = Atom.fnSync<boolean>()(
      (touched, get) => {
        const state = get(stateAtom)
        if (Option.isNone(state)) return
        get.set(stateAtom, Option.some(operations.setFieldTouched(state.value, field.key, touched)))
      },
      { initialValue: undefined as void }
    ).pipe(Atom.setIdleTTL(0))

    const validateFieldAtom = Atom.fnSync<void>()(
      (_: void, get) => {
        const value = get(internal.valueAtom)
        get.set(internal.validationAtom as Atom.Writable<any, any>, value)
        get.set(internal.fieldValidationCountAtom, get(internal.fieldValidationCountAtom) + 1)
      },
      { initialValue: undefined as void }
    ).pipe(Atom.setIdleTTL(0))

    const bundle: PublicFieldAtoms<S> = {
      value,
      error,
      isDirty,
      isTouched,
      isValidating,
      setValue: setValueAtom,
      setTouched: setTouchedAtom,
      validate: validateFieldAtom
    }
    publicFieldAtomsRegistry.set(field.key, bundle as PublicFieldAtoms<unknown>)
    return bundle
  }

  const mountAtom = Atom.readable((get) => {
    get(stateAtom)
    get(errorsAtom)
    get(submitAtom)
  }).pipe(Atom.setIdleTTL(0))

  const keepAliveActiveAtom = Atom.make(false).pipe(Atom.setIdleTTL(0))

  const autoSubmitAtom: Atom.Atom<void> = parsedMode.autoSubmit && parsedMode.validation === "onChange"
    ? Atom.readable((get) => {
      const initialState = get.once(stateAtom)
      let lastValues: unknown = Option.isSome(initialState)
        ? initialState.value.values
        : null
      let pendingChanges = false
      let wasSubmitting = false
      let timeout: ReturnType<typeof setTimeout> | undefined

      const debounceMs = parsedMode.debounce

      const triggerSubmit = () => {
        if (get.once(submitAtom).waiting) {
          pendingChanges = true
          return
        }
        get.set(submitAtom as Atom.Writable<any, any>, undefined)
      }

      const debouncedSubmit = () => {
        if (debounceMs !== null && debounceMs > 0) {
          if (timeout !== undefined) clearTimeout(timeout)
          timeout = setTimeout(() => {
            timeout = undefined
            triggerSubmit()
          }, debounceMs)
        } else {
          triggerSubmit()
        }
      }

      get.addFinalizer(() => {
        if (timeout !== undefined) clearTimeout(timeout)
      })

      get.subscribe(stateAtom, () => {
        const state = get.once(stateAtom)
        if (Option.isNone(state)) return
        const currentValues = state.value.values
        if (currentValues === lastValues) return
        lastValues = currentValues

        const submitResult = get.once(submitAtom)
        if (submitResult.waiting) {
          pendingChanges = true
        } else {
          debouncedSubmit()
        }
      })

      get.subscribe(submitAtom, () => {
        const result = get.once(submitAtom)
        const isSubmitting = result.waiting
        if (wasSubmitting && !isSubmitting) {
          if (pendingChanges) {
            pendingChanges = false
            debouncedSubmit()
          }
        }
        wasSubmitting = isSubmitting
      })
    }).pipe(Atom.setIdleTTL(0))
    : Atom.readable(() => {}).pipe(Atom.setIdleTTL(0))

  const onBlurSubmitAtom: Atom.Writable<void, void> = parsedMode.autoSubmit && parsedMode.validation === "onBlur"
    ? Atom.fnSync<void>()((_: void, get) => {
      if (get(submitAtom).waiting) return
      const stateOption = get(stateAtom)
      if (Option.isNone(stateOption)) return
      const { lastSubmittedValues, values } = stateOption.value
      if (Option.isSome(lastSubmittedValues) && values === lastSubmittedValues.value.encoded) return
      get.set(submitAtom as Atom.Writable<any, any>, undefined)
    }, { initialValue: undefined as void }).pipe(Atom.setIdleTTL(0))
    : Atom.fnSync<void>()((_: void) => {}, { initialValue: undefined as void })
      .pipe(Atom.setIdleTTL(0))

  return {
    stateAtom,
    errorsAtom,
    rootErrorAtom,
    valuesAtom,
    dirtyFieldsAtom,
    isDirtyAtom,
    submitCountAtom,
    validationCountAtom,
    lastSubmittedValuesAtom,
    changedSinceSubmitFieldsAtom,
    hasChangedSinceSubmitAtom,
    submitAtom,
    validateAtom,
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
    getFieldAtoms,
    autoSubmitAtom,
    onBlurSubmitAtom,
    mountAtom,
    keepAliveActiveAtom
  } as FormAtoms<TFields, R, A, E, SubmitArgs>
}
