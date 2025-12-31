import { RegistryContext, useAtom, useAtomSet, useAtomSubscribe, useAtomValue } from "@effect-atom/atom-react"
import * as Atom from "@effect-atom/atom/Atom"
import { Field, FormAtoms, Mode, Validation } from "@lucas-barake/effect-form"
import type * as FormBuilder from "@lucas-barake/effect-form/FormBuilder"
import { getNestedValue, isPathOrParentDirty, isPathUnderRoot } from "@lucas-barake/effect-form/Path"
import * as Cause from "effect/Cause"
import type * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as ParseResult from "effect/ParseResult"
import * as Predicate from "effect/Predicate"
import type * as Schema from "effect/Schema"
import * as AST from "effect/SchemaAST"
import * as React from "react"
import { createContext, useContext } from "react"
import { useDebounced } from "./internal/use-debounced.js"

/**
 * Form-controlled state passed to field components.
 *
 * @category Models
 */
export interface FieldState<S extends Schema.Schema.Any> {
  readonly value: Schema.Schema.Encoded<S>
  readonly onChange: (value: Schema.Schema.Encoded<S>) => void
  readonly onBlur: () => void
  readonly error: Option.Option<string>
  readonly isTouched: boolean
  readonly isValidating: boolean
  readonly isDirty: boolean
}

/**
 * Props passed to field components.
 * Contains form-controlled state in `field` and user-defined props in `props`.
 *
 * @category Models
 */
export interface FieldComponentProps<
  S extends Schema.Schema.Any,
  P extends Record<string, unknown> = Record<string, never>,
> {
  readonly field: FieldState<S>
  readonly props: P
}

/**
 * A bundled field definition + component for reusable form fields.
 * Created with `FormReact.makeField`.
 *
 * @category Models
 */
export interface FieldBundle<
  K extends string,
  S extends Schema.Schema.Any,
  P extends Record<string, unknown> = Record<string, never>,
> {
  readonly _tag: "FieldBundle"
  readonly field: Field.FieldDef<K, S>
  readonly component: React.FC<FieldComponentProps<S, P>>
}

const isFieldBundle = (x: unknown): x is FieldBundle<string, Schema.Schema.Any, Record<string, unknown>> =>
  Predicate.isTagged(x, "FieldBundle")

/**
 * Extracts the extra props type from a field component.
 *
 * @category Type-level utilities
 */
export type ExtractExtraProps<C> = C extends React.FC<FieldComponentProps<any, infer P>> ? P
  : C extends FieldBundle<any, any, infer P> ? P
  : Record<string, never>

/**
 * Extracts field component map for array item schemas.
 * - For Struct schemas: returns a map of field names to components
 * - For primitive schemas: returns a single component
 *
 * @category Models
 */
export type ArrayItemComponentMap<S extends Schema.Schema.Any> = S extends Schema.Struct<infer Fields> ? {
    readonly [K in keyof Fields]: Fields[K] extends Schema.Schema.Any ? React.FC<FieldComponentProps<Fields[K], any>>
      : never
  }
  : React.FC<FieldComponentProps<S, any>>

/**
 * Maps field names to their React components.
 *
 * @category Models
 */
export type FieldComponentMap<TFields extends Field.FieldsRecord> = {
  readonly [K in keyof TFields]: TFields[K] extends Field.FieldDef<any, infer S>
    ? React.FC<FieldComponentProps<S, any>> | FieldBundle<any, S, any>
    : TFields[K] extends Field.ArrayFieldDef<any, infer S> ? ArrayItemComponentMap<S>
    : never
}

/**
 * Maps field names to their type-safe Field references for setValue operations.
 *
 * @category Models
 */
export type FieldRefs<TFields extends Field.FieldsRecord> = FormAtoms.FieldRefs<TFields>

/**
 * Operations available for array fields.
 *
 * @category Models
 */
export interface ArrayFieldOperations<TItem> {
  readonly items: ReadonlyArray<TItem>
  readonly append: (value?: TItem) => void
  readonly remove: (index: number) => void
  readonly swap: (indexA: number, indexB: number) => void
  readonly move: (from: number, to: number) => void
}

/**
 * The result of building a form, containing all components and utilities needed
 * for form rendering and submission.
 *
 * @category Models
 */
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

const makeFieldComponent = <S extends Schema.Schema.Any, P extends Record<string, unknown>>(
  fieldKey: string,
  fieldDef: Field.FieldDef<string, S>,
  crossFieldErrorsAtom: Atom.Writable<Map<string, string>, Map<string, string>>,
  submitCountAtom: Atom.Atom<number>,
  dirtyFieldsAtom: Atom.Atom<ReadonlySet<string>>,
  parsedMode: Mode.ParsedMode,
  getOrCreateValidationAtom: (
    fieldPath: string,
    schema: Schema.Schema.Any,
  ) => Atom.AtomResultFn<unknown, void, ParseResult.ParseError>,
  getOrCreateFieldAtoms: (fieldPath: string) => FormAtoms.FieldAtoms,
  Component: React.FC<FieldComponentProps<S, P>>,
): React.FC<P> => {
  const FieldComponent: React.FC<P> = (extraProps) => {
    const arrayCtx = useContext(ArrayItemContext)
    const autoSubmitOnBlur = useContext(AutoSubmitContext)
    const fieldPath = arrayCtx ? `${arrayCtx.parentPath}.${fieldKey}` : fieldKey

    const { crossFieldErrorAtom, touchedAtom, valueAtom } = React.useMemo(
      () => getOrCreateFieldAtoms(fieldPath),
      [fieldPath],
    )

    const [value, setValue] = useAtom(valueAtom) as [Schema.Schema.Encoded<S>, (v: unknown) => void]
    const [isTouched, setTouched] = useAtom(touchedAtom)
    const crossFieldError = useAtomValue(crossFieldErrorAtom)
    const setCrossFieldErrors = useAtomSet(crossFieldErrorsAtom)
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

      if (shouldValidate) {
        validate(value)
      }
    }, [value, isTouched, validate])

    const perFieldError: Option.Option<string> = React.useMemo(() => {
      if (validationResult._tag === "Failure") {
        const parseError = Cause.failureOption(validationResult.cause)
        if (Option.isSome(parseError) && ParseResult.isParseError(parseError.value)) {
          return Validation.extractFirstError(parseError.value)
        }
      }
      return Option.none()
    }, [validationResult])

    const validationError = Option.isSome(perFieldError) ? perFieldError : crossFieldError

    const onChange = React.useCallback(
      (newValue: Schema.Schema.Encoded<S>) => {
        setValue(newValue)
        setCrossFieldErrors((prev) => {
          const next = new Map<string, string>()
          for (const [errorPath, message] of prev) {
            if (!isPathUnderRoot(errorPath, fieldPath)) {
              next.set(errorPath, message)
            }
          }
          return next.size !== prev.size ? next : prev
        })
        if (parsedMode.validation === "onChange") {
          validate(newValue)
        }
      },
      [fieldPath, setValue, setCrossFieldErrors, validate],
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
    const isValidating = validationResult.waiting
    const shouldShowError = isTouched || submitCount > 0

    const fieldState: FieldState<S> = React.useMemo(() => ({
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
  crossFieldErrorsAtom: Atom.Writable<Map<string, string>, Map<string, string>>,
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
        crossFieldErrorsAtom,
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
  crossFieldErrorsAtom: Atom.Writable<Map<string, string>, Map<string, string>>,
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
        crossFieldErrorsAtom,
        submitCountAtom,
        dirtyFieldsAtom,
        parsedMode,
        getOrCreateValidationAtom,
        getOrCreateFieldAtoms,
        operations,
        arrayComponentMap,
      )
    } else if (Field.isFieldDef(def)) {
      const componentOrBundle = (componentMap as Record<string, unknown>)[key]
      const fieldComponent = isFieldBundle(componentOrBundle)
        ? componentOrBundle.component
        : componentOrBundle as React.FC<FieldComponentProps<any, any>>
      components[key] = makeFieldComponent(
        key,
        def,
        crossFieldErrorsAtom,
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

/**
 * Creates a React form from a FormBuilder.
 *
 * @example
 * ```tsx
 * import { FormBuilder } from "@lucas-barake/effect-form"
 * import { FormReact } from "@lucas-barake/effect-form-react"
 * import { useAtomValue, useAtomSet } from "@effect-atom/atom-react"
 * import * as Schema from "effect/Schema"
 *
 * const loginFormBuilder = FormBuilder.empty
 *   .addField("email", Schema.String)
 *   .addField("password", Schema.String)
 *
 * // Runtime is optional for forms without service requirements
 * const loginForm = FormReact.make(loginFormBuilder, {
 *   fields: { email: TextInput, password: PasswordInput },
 *   onSubmit: (_, { decoded }) => Effect.log(`Login: ${decoded.email}`),
 * })
 *
 * // Subscribe to atoms anywhere in the tree
 * function SubmitButton() {
 *   const isDirty = useAtomValue(loginForm.isDirty)
 *   const submit = useAtomValue(loginForm.submit)
 *   const callSubmit = useAtomSet(loginForm.submit)
 *   return (
 *     <button onClick={() => callSubmit()} disabled={!isDirty || submit.waiting}>
 *       {submit.waiting ? "Validating..." : "Login"}
 *     </button>
 *   )
 * }
 *
 * function LoginPage() {
 *   return (
 *     <loginForm.Initialize defaultValues={{ email: "", password: "" }}>
 *       <loginForm.email />
 *       <loginForm.password />
 *       <SubmitButton />
 *     </loginForm.Initialize>
 *   )
 * }
 * ```
 *
 * @category Constructors
 */
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
    crossFieldErrorsAtom,
    dirtyFieldsAtom,
    fieldRefs,
    getFieldAtom,
    getOrCreateFieldAtoms,
    getOrCreateValidationAtom,
    hasChangedSinceSubmitAtom,
    isDirtyAtom,
    lastSubmittedValuesAtom,
    operations,
    resetAtom,
    revertToLastSubmitAtom,
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
      setFormState(Option.some(operations.createInitialState(defaultValues)))
      isInitializedRef.current = true
      // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
    }, [])

    const debouncedAutoSubmit = useDebounced(() => {
      const stateOption = registry.get(stateAtom)
      if (Option.isNone(stateOption)) return
      callSubmit(undefined)
    }, parsedMode.autoSubmit && parsedMode.validation === "onChange" ? parsedMode.debounce : null)

    useAtomSubscribe(
      stateAtom,
      React.useCallback(() => {
        if (!isInitializedRef.current) return
        if (parsedMode.autoSubmit && parsedMode.validation === "onChange") {
          debouncedAutoSubmit()
        }
      }, [debouncedAutoSubmit]),
      { immediate: false },
    )

    const onBlurAutoSubmit = React.useCallback(() => {
      if (parsedMode.autoSubmit && parsedMode.validation === "onBlur") {
        const stateOption = registry.get(stateAtom)
        if (Option.isNone(stateOption)) return
        callSubmit(undefined)
      }
    }, [registry, callSubmit])

    if (Option.isNone(state)) return null

    return (
      <AutoSubmitContext.Provider value={onBlurAutoSubmit}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          {children}
        </form>
      </AutoSubmitContext.Provider>
    )
  }

  const fieldComponents = makeFieldComponents(
    fields,
    stateAtom,
    crossFieldErrorsAtom,
    submitCountAtom,
    dirtyFieldsAtom,
    parsedMode,
    getOrCreateValidationAtom,
    getOrCreateFieldAtoms,
    operations,
    components,
  )

  return {
    values: valuesAtom,
    isDirty: isDirtyAtom,
    hasChangedSinceSubmit: hasChangedSinceSubmitAtom,
    lastSubmittedValues: lastSubmittedValuesAtom,
    submitCount: submitCountAtom,
    schema: combinedSchema,
    fields: fieldRefs,
    Initialize: InitializeComponent,
    submit: submitAtom,
    reset: resetAtom,
    revertToLastSubmit: revertToLastSubmitAtom,
    setValues: setValuesAtom,
    setValue,
    getFieldAtom,
    ...fieldComponents,
  }
}

/**
 * A curried helper that infers the schema type from a field definition.
 * Provides ergonomic type inference when defining field components.
 *
 * @example
 * ```tsx
 * import { Field, FormReact } from "@lucas-barake/effect-form-react"
 *
 * const EmailField = Field.makeField("email", Schema.String)
 * const TextInput = FormReact.forField(EmailField)(({ field }) => (
 *   <input value={field.value} onChange={e => field.onChange(e.target.value)} />
 * ))
 *
 * // With extra props - just specify the props type
 * const TextInput = FormReact.forField(EmailField)<{ placeholder?: string }>(({ field, props }) => (
 *   <input value={field.value} placeholder={props.placeholder} ... />
 * ))
 * ```
 *
 * @category Constructors
 */
export const forField = <K extends string, S extends Schema.Schema.Any>(
  _field: Field.FieldDef<K, S>,
): <P extends Record<string, unknown> = Record<string, never>>(
  component: React.FC<FieldComponentProps<S, P>>,
) => React.FC<FieldComponentProps<S, P>> =>
(component) => component

/**
 * Creates a bundled field definition + component for reusable form fields.
 * Reduces boilerplate when you need both a field and its component together.
 *
 * Uses a curried API for better type inference - the schema type is captured
 * first, so you only need to specify the extra props type (if any).
 *
 * @example
 * ```tsx
 * import { FormReact } from "@lucas-barake/effect-form-react"
 * import * as Schema from "effect/Schema"
 *
 * // Define field + component in one place (no extra props)
 * const NameInput = FormReact.makeField({
 *   key: "name",
 *   schema: Schema.String.pipe(Schema.nonEmptyString()),
 * })(({ field }) => (
 *   <input
 *     value={field.value}
 *     onChange={(e) => field.onChange(e.target.value)}
 *     onBlur={field.onBlur}
 *   />
 * ))
 *
 * // With extra props - specify only the props type
 * const EmailInput = FormReact.makeField({
 *   key: "email",
 *   schema: Schema.String,
 * })<{ placeholder: string }>(({ field, props }) => (
 *   <input
 *     value={field.value}
 *     onChange={(e) => field.onChange(e.target.value)}
 *     placeholder={props.placeholder}
 *   />
 * ))
 *
 * // Use in form builder
 * const formBuilder = FormBuilder.empty.addField(NameInput.field)
 *
 * // Use in make()
 * const form = FormReact.make(formBuilder, {
 *   runtime,
 *   fields: { name: NameInput },
 *   onSubmit: (_, { decoded }) => Effect.log(decoded.name),
 * })
 * ```
 *
 * @category Constructors
 */
export const makeField = <K extends string, S extends Schema.Schema.Any>(options: {
  readonly key: K
  readonly schema: S
}): <P extends Record<string, unknown> = Record<string, never>>(
  component: React.FC<FieldComponentProps<S, P>>
) => FieldBundle<K, S, P> => {
  const field = Field.makeField(options.key, options.schema)
  return (component) => {
    // DX: Auto-generate a readable component name for DevTools
    if (!component.displayName) {
      const displayName = `${options.key.charAt(0).toUpperCase()}${options.key.slice(1)}Field`
      // Cast to 'any' because strict TS marks function names as readonly,
      // but React relies on mutation here.
      try {
        ;(component as any).displayName = displayName
      } catch {
        // Ignore errors in environments where function props are frozen
      }
    }
    return {
      _tag: "FieldBundle",
      field,
      component,
    }
  }
}
