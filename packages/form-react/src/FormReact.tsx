import {
  RegistryContext,
  useAtom,
  useAtomMount,
  useAtomSet,
  useAtomSubscribe,
  useAtomValue,
} from "@effect-atom/atom-react"
import * as Atom from "@effect-atom/atom/Atom"
import { Field, FormAtoms, Mode, Validation } from "@lucas-barake/effect-form"
import type * as FormBuilder from "@lucas-barake/effect-form/FormBuilder"
import { getNestedValue, isPathOrParentDirty } from "@lucas-barake/effect-form/Path"
import * as Cause from "effect/Cause"
import type * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as ParseResult from "effect/ParseResult"
import type * as Schema from "effect/Schema"
import * as AST from "effect/SchemaAST"
import * as React from "react"
import { createContext, useContext } from "react"
import { useDebounced } from "./internal/use-debounced.js"

export type FieldValue<T> = T extends Schema.Schema.Any ? Schema.Schema.Encoded<T> : T

export interface FieldState<E> {
  readonly value: E
  readonly onChange: (value: E) => void
  readonly onBlur: () => void
  readonly error: Option.Option<string>
  readonly isTouched: boolean
  readonly isValidating: boolean
  readonly isDirty: boolean
}

export interface FieldComponentProps<E, P = Record<string, never>> {
  readonly field: FieldState<E>
  readonly props: P
}

export type FieldComponent<T, P = Record<string, never>> = React.FC<FieldComponentProps<FieldValue<T>, P>>

export type ExtractExtraProps<C> = C extends React.FC<FieldComponentProps<any, infer P>> ? P : Record<string, never>

export type ArrayItemComponentMap<S extends Schema.Schema.Any> = S extends Schema.Struct<infer Fields> ? {
    readonly [K in keyof Fields]: Fields[K] extends Schema.Schema.Any
      ? React.FC<FieldComponentProps<Schema.Schema.Encoded<Fields[K]>, any>>
      : never
  }
  : React.FC<FieldComponentProps<Schema.Schema.Encoded<S>, any>>

export type FieldComponentMap<TFields extends Field.FieldsRecord> = {
  readonly [K in keyof TFields]: TFields[K] extends Field.FieldDef<any, infer S>
    ? React.FC<FieldComponentProps<Schema.Schema.Encoded<S>, any>>
    : TFields[K] extends Field.ArrayFieldDef<any, infer S> ? ArrayItemComponentMap<S>
    : never
}

export type FieldRefs<TFields extends Field.FieldsRecord> = FormAtoms.FieldRefs<TFields>

export interface ArrayFieldOperations<TItem> {
  readonly items: ReadonlyArray<TItem>
  readonly append: (value?: TItem) => void
  readonly remove: (index: number) => void
  readonly swap: (indexA: number, indexB: number) => void
  readonly move: (from: number, to: number) => void
}

export type BuiltForm<
  TFields extends Field.FieldsRecord,
  R,
  A = void,
  E = never,
  SubmitArgs = void,
  CM extends FieldComponentMap<TFields> = FieldComponentMap<TFields>,
> = {
  readonly values: Atom.Atom<Option.Option<Field.EncodedFromFields<TFields>>>
  readonly isDirty: Atom.Atom<boolean>
  readonly hasChangedSinceSubmit: Atom.Atom<boolean>
  readonly lastSubmittedValues: Atom.Atom<Option.Option<FormBuilder.SubmittedValues<TFields>>>
  readonly submitCount: Atom.Atom<number>

  readonly schema: Schema.Schema<Field.DecodedFromFields<TFields>, Field.EncodedFromFields<TFields>, R>
  readonly fields: FieldRefs<TFields>

  readonly Initialize: React.FC<{
    readonly defaultValues: Field.EncodedFromFields<TFields>
    readonly children: React.ReactNode
  }>

  readonly submit: Atom.AtomResultFn<SubmitArgs, A, E | ParseResult.ParseError>
  readonly reset: Atom.Writable<void, void>
  readonly revertToLastSubmit: Atom.Writable<void, void>
  readonly setValues: Atom.Writable<void, Field.EncodedFromFields<TFields>>
  readonly setValue: <S>(field: FormBuilder.FieldRef<S>) => Atom.Writable<void, S | ((prev: S) => S)>
  readonly getFieldAtom: <S>(field: FormBuilder.FieldRef<S>) => Atom.Atom<Option.Option<S>>

  readonly mount: Atom.Atom<void>
  readonly KeepAlive: React.FC
} & FieldComponents<TFields, CM>

type FieldComponents<TFields extends Field.FieldsRecord, CM extends FieldComponentMap<TFields>> = {
  readonly [K in keyof TFields]: TFields[K] extends Field.FieldDef<any, any> ? React.FC<ExtractExtraProps<CM[K]>>
    : TFields[K] extends Field.ArrayFieldDef<any, infer S>
      ? ArrayFieldComponent<S, ExtractArrayItemExtraProps<CM[K], S>>
    : never
}

type ExtractArrayItemExtraProps<CM, S extends Schema.Schema.Any> = S extends Schema.Struct<infer Fields>
  ? { readonly [K in keyof Fields]: CM extends { readonly [P in K]: infer C } ? ExtractExtraProps<C> : never }
  : CM extends React.FC<FieldComponentProps<any, infer P>> ? P
  : never

type ArrayFieldComponent<S extends Schema.Schema.Any, ExtraPropsMap> =
  & React.FC<{
    readonly children: (ops: ArrayFieldOperations<Schema.Schema.Encoded<S>>) => React.ReactNode
  }>
  & {
    readonly Item: React.FC<{
      readonly index: number
      readonly children: React.ReactNode | ((props: { readonly remove: () => void }) => React.ReactNode)
    }>
  }
  & (S extends Schema.Struct<infer Fields> ? {
      readonly [K in keyof Fields]: React.FC<
        ExtraPropsMap extends { readonly [P in K]: infer EP } ? EP : Record<string, never>
      >
    }
    : unknown)

interface ArrayItemContextValue {
  readonly index: number
  readonly parentPath: string
}

const ArrayItemContext = createContext<ArrayItemContextValue | null>(null)
const AutoSubmitContext = createContext<(() => void) | null>(null)

const makeFieldComponent = <S extends Schema.Schema.Any, P>(
  fieldKey: string,
  fieldDef: Field.FieldDef<string, S>,
  errorsAtom: Atom.Writable<Map<string, Validation.ErrorEntry>, Map<string, Validation.ErrorEntry>>,
  submitCountAtom: Atom.Atom<number>,
  dirtyFieldsAtom: Atom.Atom<ReadonlySet<string>>,
  parsedMode: Mode.ParsedMode,
  getOrCreateValidationAtom: (
    fieldPath: string,
    schema: Schema.Schema.Any,
  ) => Atom.AtomResultFn<unknown, void, ParseResult.ParseError>,
  getOrCreateFieldAtoms: (fieldPath: string) => FormAtoms.FieldAtoms,
  Component: React.FC<FieldComponentProps<Schema.Schema.Encoded<S>, P>>,
): React.FC<P> => {
  const FieldComponent: React.FC<P> = (extraProps) => {
    const arrayCtx = useContext(ArrayItemContext)
    const autoSubmitOnBlur = useContext(AutoSubmitContext)
    const fieldPath = arrayCtx ? `${arrayCtx.parentPath}.${fieldKey}` : fieldKey

    const { errorAtom, touchedAtom, valueAtom } = React.useMemo(
      () => getOrCreateFieldAtoms(fieldPath),
      [fieldPath],
    )

    const [value, setValue] = useAtom(valueAtom) as [Schema.Schema.Encoded<S>, (v: unknown) => void]
    const [isTouched, setTouched] = useAtom(touchedAtom)
    const storedError = useAtomValue(errorAtom)
    const submitCount = useAtomValue(submitCountAtom)

    const validationAtom = React.useMemo(
      () => getOrCreateValidationAtom(fieldPath, fieldDef.schema),
      [fieldPath],
    )
    const validationResult = useAtomValue(validationAtom)
    const validateImmediate = useAtomSet(validationAtom)

    const shouldDebounceValidation = parsedMode.validation === "onChange"
      && parsedMode.debounce !== null
      && !parsedMode.autoSubmit
    const validate = useDebounced(validateImmediate, shouldDebounceValidation ? parsedMode.debounce : null)

    const prevValueRef = React.useRef(value)
    React.useEffect(() => {
      if (prevValueRef.current === value) {
        return
      }
      prevValueRef.current = value

      const shouldValidate = parsedMode.validation === "onChange"
        || (parsedMode.validation === "onBlur" && isTouched)
        || (parsedMode.validation === "onSubmit" && submitCount > 0)

      if (shouldValidate) {
        validate(value)
      }
    }, [value, isTouched, submitCount, validate])

    const livePerFieldError: Option.Option<string> = React.useMemo(() => {
      if (validationResult._tag === "Failure") {
        const parseError = Cause.failureOption(validationResult.cause)
        if (Option.isSome(parseError) && ParseResult.isParseError(parseError.value)) {
          return Validation.extractFirstError(parseError.value)
        }
      }
      return Option.none()
    }, [validationResult])

    const isValidating = validationResult.waiting

    const validationError: Option.Option<string> = React.useMemo(() => {
      if (Option.isSome(livePerFieldError)) {
        return livePerFieldError
      }

      if (Option.isSome(storedError)) {
        // Hide field-sourced errors when validation passes or is pending (async gap).
        // Refinement errors persist until re-submit - they can't be cleared by typing.
        const shouldHideStoredError = storedError.value.source === "field" &&
          (validationResult._tag === "Success" || isValidating)

        if (shouldHideStoredError) {
          return Option.none()
        }
        return Option.some(storedError.value.message)
      }

      return Option.none()
    }, [livePerFieldError, storedError, validationResult, isValidating])

    const onChange = React.useCallback(
      (newValue: Schema.Schema.Encoded<S>) => {
        setValue(newValue)
      },
      [setValue],
    )

    const onBlur = React.useCallback(() => {
      setTouched(true)
      if (parsedMode.validation === "onBlur") {
        validate(value)
      }
      autoSubmitOnBlur?.()
    }, [setTouched, validate, value, autoSubmitOnBlur])

    const dirtyFields = useAtomValue(dirtyFieldsAtom)
    const isDirty = React.useMemo(
      () => isPathOrParentDirty(dirtyFields, fieldPath),
      [dirtyFields, fieldPath],
    )
    const shouldShowError = parsedMode.validation === "onChange"
      ? (isDirty || submitCount > 0)
      : parsedMode.validation === "onBlur"
      ? (isTouched || submitCount > 0)
      : submitCount > 0

    const fieldState: FieldState<Schema.Schema.Encoded<S>> = React.useMemo(() => ({
      value,
      onChange,
      onBlur,
      error: shouldShowError ? validationError : Option.none<string>(),
      isTouched,
      isValidating,
      isDirty,
    }), [value, onChange, onBlur, shouldShowError, validationError, isTouched, isValidating, isDirty])

    return <Component field={fieldState} props={extraProps} />
  }

  return React.memo(FieldComponent) as React.FC<P>
}

const makeArrayFieldComponent = <S extends Schema.Schema.Any>(
  fieldKey: string,
  def: Field.ArrayFieldDef<string, S>,
  stateAtom: Atom.Writable<Option.Option<FormBuilder.FormState<any>>, Option.Option<FormBuilder.FormState<any>>>,
  errorsAtom: Atom.Writable<Map<string, Validation.ErrorEntry>, Map<string, Validation.ErrorEntry>>,
  submitCountAtom: Atom.Atom<number>,
  dirtyFieldsAtom: Atom.Atom<ReadonlySet<string>>,
  parsedMode: Mode.ParsedMode,
  getOrCreateValidationAtom: (
    fieldPath: string,
    schema: Schema.Schema.Any,
  ) => Atom.AtomResultFn<unknown, void, ParseResult.ParseError>,
  getOrCreateFieldAtoms: (fieldPath: string) => FormAtoms.FieldAtoms,
  operations: FormAtoms.FormOperations<any>,
  componentMap: ArrayItemComponentMap<S>,
): ArrayFieldComponent<S, any> => {
  const isStructSchema = AST.isTypeLiteral(def.itemSchema.ast)

  const ArrayWrapper: React.FC<{
    readonly children: (ops: ArrayFieldOperations<Schema.Schema.Encoded<S>>) => React.ReactNode
  }> = ({ children }) => {
    const arrayCtx = useContext(ArrayItemContext)
    const [formStateOption, setFormState] = useAtom(stateAtom)
    const formState = Option.getOrThrow(formStateOption)

    const fieldPath = arrayCtx ? `${arrayCtx.parentPath}.${fieldKey}` : fieldKey
    const items = React.useMemo(
      () => (getNestedValue(formState.values, fieldPath) ?? []) as ReadonlyArray<Schema.Schema.Encoded<S>>,
      [formState.values, fieldPath],
    )

    const append = React.useCallback(
      (value?: Schema.Schema.Encoded<S>) => {
        setFormState((prev) => {
          if (Option.isNone(prev)) return prev
          return Option.some(operations.appendArrayItem(prev.value, fieldPath, def.itemSchema, value))
        })
      },
      [fieldPath, setFormState],
    )

    const remove = React.useCallback(
      (index: number) => {
        setFormState((prev) => {
          if (Option.isNone(prev)) return prev
          return Option.some(operations.removeArrayItem(prev.value, fieldPath, index))
        })
      },
      [fieldPath, setFormState],
    )

    const swap = React.useCallback(
      (indexA: number, indexB: number) => {
        setFormState((prev) => {
          if (Option.isNone(prev)) return prev
          return Option.some(operations.swapArrayItems(prev.value, fieldPath, indexA, indexB))
        })
      },
      [fieldPath, setFormState],
    )

    const move = React.useCallback(
      (from: number, to: number) => {
        setFormState((prev) => {
          if (Option.isNone(prev)) return prev
          return Option.some(operations.moveArrayItem(prev.value, fieldPath, from, to))
        })
      },
      [fieldPath, setFormState],
    )

    return <>{children({ items, append, remove, swap, move })}</>
  }

  const ItemWrapper: React.FC<{
    readonly index: number
    readonly children: React.ReactNode | ((props: { readonly remove: () => void }) => React.ReactNode)
  }> = ({ children, index }) => {
    const arrayCtx = useContext(ArrayItemContext)
    const setFormState = useAtomSet(stateAtom)

    const parentPath = arrayCtx ? `${arrayCtx.parentPath}.${fieldKey}` : fieldKey
    const itemPath = `${parentPath}[${index}]`

    const remove = React.useCallback(() => {
      setFormState((prev) => {
        if (Option.isNone(prev)) return prev
        return Option.some(operations.removeArrayItem(prev.value, parentPath, index))
      })
    }, [parentPath, index, setFormState])

    return (
      <ArrayItemContext.Provider value={{ index, parentPath: itemPath }}>
        {typeof children === "function" ? children({ remove }) : children}
      </ArrayItemContext.Provider>
    )
  }

  const itemFieldComponents: Record<string, React.FC> = {}

  if (isStructSchema) {
    const ast = def.itemSchema.ast as AST.TypeLiteral
    for (const prop of ast.propertySignatures) {
      const itemKey = prop.name as string
      const itemSchema = { ast: prop.type } as Schema.Schema.Any
      const itemDef = Field.makeField(itemKey, itemSchema)
      const itemComponent = (componentMap as Record<string, React.FC<FieldComponentProps<any, any>>>)[itemKey]
      itemFieldComponents[itemKey] = makeFieldComponent(
        itemKey,
        itemDef,
        errorsAtom,
        submitCountAtom,
        dirtyFieldsAtom,
        parsedMode,
        getOrCreateValidationAtom,
        getOrCreateFieldAtoms,
        itemComponent,
      )
    }
  }

  const properties: Record<string, unknown> = {
    Item: ItemWrapper,
    ...itemFieldComponents,
  }

  return new Proxy(ArrayWrapper, {
    get(target, prop) {
      if (prop in properties) {
        return properties[prop as string]
      }
      return Reflect.get(target, prop)
    },
  }) as ArrayFieldComponent<S, any>
}

const makeFieldComponents = <
  TFields extends Field.FieldsRecord,
  CM extends FieldComponentMap<TFields>,
>(
  fields: TFields,
  stateAtom: Atom.Writable<
    Option.Option<FormBuilder.FormState<TFields>>,
    Option.Option<FormBuilder.FormState<TFields>>
  >,
  errorsAtom: Atom.Writable<Map<string, Validation.ErrorEntry>, Map<string, Validation.ErrorEntry>>,
  submitCountAtom: Atom.Atom<number>,
  dirtyFieldsAtom: Atom.Atom<ReadonlySet<string>>,
  parsedMode: Mode.ParsedMode,
  getOrCreateValidationAtom: (
    fieldPath: string,
    schema: Schema.Schema.Any,
  ) => Atom.AtomResultFn<unknown, void, ParseResult.ParseError>,
  getOrCreateFieldAtoms: (fieldPath: string) => FormAtoms.FieldAtoms,
  operations: FormAtoms.FormOperations<TFields>,
  componentMap: CM,
): FieldComponents<TFields, CM> => {
  const components: Record<string, any> = {}

  for (const [key, def] of Object.entries(fields)) {
    if (Field.isArrayFieldDef(def)) {
      const arrayComponentMap = (componentMap as Record<string, any>)[key]
      components[key] = makeArrayFieldComponent(
        key,
        def as Field.ArrayFieldDef<string, Schema.Schema.Any>,
        stateAtom,
        errorsAtom,
        submitCountAtom,
        dirtyFieldsAtom,
        parsedMode,
        getOrCreateValidationAtom,
        getOrCreateFieldAtoms,
        operations,
        arrayComponentMap,
      )
    } else if (Field.isFieldDef(def)) {
      const fieldComponent = (componentMap as Record<string, React.FC<FieldComponentProps<any, any>>>)[key]
      components[key] = makeFieldComponent(
        key,
        def,
        errorsAtom,
        submitCountAtom,
        dirtyFieldsAtom,
        parsedMode,
        getOrCreateValidationAtom,
        getOrCreateFieldAtoms,
        fieldComponent,
      )
    }
  }

  return components as FieldComponents<TFields, CM>
}

export const make: {
  <
    TFields extends Field.FieldsRecord,
    A,
    E,
    SubmitArgs = void,
    CM extends FieldComponentMap<TFields> = FieldComponentMap<TFields>,
  >(
    self: FormBuilder.FormBuilder<TFields, never>,
    options: {
      readonly runtime?: Atom.AtomRuntime<never, never>
      readonly fields: CM
      readonly mode?: SubmitArgs extends void ? Mode.FormMode : Mode.FormModeWithoutAutoSubmit
      readonly onSubmit: (
        args: SubmitArgs,
        ctx: {
          readonly decoded: Field.DecodedFromFields<TFields>
          readonly encoded: Field.EncodedFromFields<TFields>
          readonly get: Atom.FnContext
        },
      ) => A | Effect.Effect<A, E, never>
    },
  ): BuiltForm<TFields, never, A, E, SubmitArgs, CM>

  <
    TFields extends Field.FieldsRecord,
    R,
    A,
    E,
    SubmitArgs = void,
    ER = never,
    CM extends FieldComponentMap<TFields> = FieldComponentMap<TFields>,
  >(
    self: FormBuilder.FormBuilder<TFields, R>,
    options: {
      readonly runtime: Atom.AtomRuntime<R, ER>
      readonly fields: CM
      readonly mode?: SubmitArgs extends void ? Mode.FormMode : Mode.FormModeWithoutAutoSubmit
      readonly onSubmit: (
        args: SubmitArgs,
        ctx: {
          readonly decoded: Field.DecodedFromFields<TFields>
          readonly encoded: Field.EncodedFromFields<TFields>
          readonly get: Atom.FnContext
        },
      ) => A | Effect.Effect<A, E, R>
    },
  ): BuiltForm<TFields, R, A, E, SubmitArgs, CM>
} = (self: any, options: any): any => {
  const { fields: components, mode, onSubmit, runtime: providedRuntime } = options
  const runtime = providedRuntime ?? Atom.runtime(Layer.empty)
  const parsedMode = Mode.parse(mode)
  const { fields } = self

  const formAtoms = FormAtoms.make({
    formBuilder: self,
    runtime,
    onSubmit,
  })

  const {
    combinedSchema,
    dirtyFieldsAtom,
    errorsAtom,
    fieldRefs,
    getFieldAtom,
    getOrCreateFieldAtoms,
    getOrCreateValidationAtom,
    hasChangedSinceSubmitAtom,
    isDirtyAtom,
    keepAliveActiveAtom,
    lastSubmittedValuesAtom,
    mountAtom,
    operations,
    resetAtom,
    revertToLastSubmitAtom,
    rootErrorAtom,
    setValue,
    setValuesAtom,
    stateAtom,
    submitAtom,
    submitCountAtom,
    valuesAtom,
  } = formAtoms

  const InitializeComponent: React.FC<{
    readonly defaultValues: any
    readonly children: React.ReactNode
  }> = ({ children, defaultValues }) => {
    const registry = React.useContext(RegistryContext)
    const state = useAtomValue(stateAtom)
    const setFormState = useAtomSet(stateAtom)
    const callSubmit = useAtomSet(submitAtom)
    const isInitializedRef = React.useRef(false)

    React.useEffect(() => {
      const isKeptAlive = registry.get(keepAliveActiveAtom)
      const currentState = registry.get(stateAtom)

      if (!isKeptAlive) {
        setFormState(Option.some(operations.createInitialState(defaultValues)))
      } else if (Option.isNone(currentState)) {
        setFormState(Option.some(operations.createInitialState(defaultValues)))
      }

      isInitializedRef.current = true
      // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
    }, [registry])

    const debouncedAutoSubmit = useDebounced(() => {
      const stateOption = registry.get(stateAtom)
      if (Option.isNone(stateOption)) return
      callSubmit(undefined)
    }, parsedMode.autoSubmit && parsedMode.validation === "onChange" ? parsedMode.debounce : null)

    // ─────────────────────────────────────────────────────────────────────────────
    // Auto-Submit Coordination
    // ─────────────────────────────────────────────────────────────────────────────
    // Two-subscription model to avoid infinite loop:
    // - Stream 1 reacts to value changes (reference equality), triggers or queues submit
    // - Stream 2 reacts to submit completion, flushes queued changes
    //
    // Single subscription to stateAtom cannot distinguish value changes from submit
    // metadata updates (submitCount, lastSubmittedValues).
    // ─────────────────────────────────────────────────────────────────────────────

    const lastValuesRef = React.useRef<unknown>(null)
    const pendingChangesRef = React.useRef(false)
    const wasSubmittingRef = React.useRef(false)

    useAtomSubscribe(
      stateAtom,
      React.useCallback(() => {
        if (!isInitializedRef.current) return

        const state = registry.get(stateAtom)
        if (Option.isNone(state)) return
        const currentValues = state.value.values

        // Reference equality filters out submit metadata changes.
        // Works because setFieldValue creates new values object (immutable update).
        if (currentValues === lastValuesRef.current) return
        lastValuesRef.current = currentValues

        if (!parsedMode.autoSubmit || parsedMode.validation !== "onChange") return

        const submitResult = registry.get(submitAtom)
        if (submitResult.waiting) {
          pendingChangesRef.current = true
        } else {
          debouncedAutoSubmit()
        }
      }, [debouncedAutoSubmit, registry]),
      { immediate: false },
    )

    useAtomSubscribe(
      submitAtom,
      React.useCallback(
        (result) => {
          if (!parsedMode.autoSubmit || parsedMode.validation !== "onChange") return

          const isSubmitting = result.waiting
          const wasSubmitting = wasSubmittingRef.current
          wasSubmittingRef.current = isSubmitting

          // Flush queued changes when submit completes
          if (wasSubmitting && !isSubmitting) {
            if (pendingChangesRef.current) {
              pendingChangesRef.current = false
              debouncedAutoSubmit()
            }
          }
        },
        [debouncedAutoSubmit],
      ),
      { immediate: false },
    )

    const onBlurAutoSubmit = React.useCallback(() => {
      if (!parsedMode.autoSubmit || parsedMode.validation !== "onBlur") return

      const stateOption = registry.get(stateAtom)
      if (Option.isNone(stateOption)) return

      const { lastSubmittedValues, values } = stateOption.value
      if (Option.isSome(lastSubmittedValues) && values === lastSubmittedValues.value.encoded) return

      callSubmit(undefined)
    }, [registry, callSubmit])

    if (Option.isNone(state)) return null

    return <AutoSubmitContext.Provider value={onBlurAutoSubmit}>{children}</AutoSubmitContext.Provider>
  }

  const fieldComponents = makeFieldComponents(
    fields,
    stateAtom,
    errorsAtom,
    submitCountAtom,
    dirtyFieldsAtom,
    parsedMode,
    getOrCreateValidationAtom,
    getOrCreateFieldAtoms,
    operations,
    components,
  )

  const KeepAlive: React.FC = () => {
    const setKeepAliveActive = useAtomSet(keepAliveActiveAtom)

    React.useLayoutEffect(() => {
      setKeepAliveActive(true)
      return () => setKeepAliveActive(false)
    }, [setKeepAliveActive])

    useAtomMount(mountAtom)
    return null
  }

  return {
    values: valuesAtom,
    isDirty: isDirtyAtom,
    hasChangedSinceSubmit: hasChangedSinceSubmitAtom,
    lastSubmittedValues: lastSubmittedValuesAtom,
    submitCount: submitCountAtom,
    rootError: rootErrorAtom,
    schema: combinedSchema,
    fields: fieldRefs,
    Initialize: InitializeComponent,
    submit: submitAtom,
    reset: resetAtom,
    revertToLastSubmit: revertToLastSubmitAtom,
    setValues: setValuesAtom,
    setValue,
    getFieldAtom,
    mount: mountAtom,
    KeepAlive,
    ...fieldComponents,
  }
}
