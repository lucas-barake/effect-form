/**
 * @since 1.0.0
 */
import { RegistryContext, useAtom, useAtomSet, useAtomSubscribe, useAtomValue } from "@effect-atom/atom-react"
import * as Atom from "@effect-atom/atom/Atom"
import type * as Result from "@effect-atom/atom/Result"
import { Field, FormAtoms, Mode, Validation } from "@lucas-barake/effect-form"
import type * as Form from "@lucas-barake/effect-form/Form"
import { getNestedValue, isPathOrParentDirty, schemaPathToFieldPath } from "@lucas-barake/effect-form/internal/path"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as ParseResult from "effect/ParseResult"
import type * as Schema from "effect/Schema"
import * as AST from "effect/SchemaAST"
import * as React from "react"
import { createContext, useContext } from "react"
import { useDebounced } from "./internal/use-debounced.js"

/**
 * Props passed to field components.
 *
 * @since 1.0.0
 * @category Models
 */
export interface FieldComponentProps<S extends Schema.Schema.Any> {
  readonly value: Schema.Schema.Encoded<S>
  readonly onChange: (value: Schema.Schema.Encoded<S>) => void
  readonly onBlur: () => void
  readonly error: Option.Option<string>
  readonly isTouched: boolean
  readonly isValidating: boolean
  readonly isDirty: boolean
}

/**
 * Extracts field component map for array item schemas.
 * - For Struct schemas: returns a map of field names to components
 * - For primitive schemas: returns a single component
 *
 * @since 1.0.0
 * @category Models
 */
export type ArrayItemComponentMap<S extends Schema.Schema.Any> = S extends Schema.Struct<infer Fields> ? {
    readonly [K in keyof Fields]: Fields[K] extends Schema.Schema.Any ? React.FC<FieldComponentProps<Fields[K]>> : never
  }
  : React.FC<FieldComponentProps<S>>

/**
 * Maps field names to their React components.
 *
 * @since 1.0.0
 * @category Models
 */
export type FieldComponentMap<TFields extends Field.FieldsRecord> = {
  readonly [K in keyof TFields]: TFields[K] extends Field.FieldDef<any, infer S> ? React.FC<FieldComponentProps<S>>
    : TFields[K] extends Field.ArrayFieldDef<any, infer S> ? ArrayItemComponentMap<S>
    : never
}

/**
 * Maps field names to their type-safe Field references for setValue operations.
 *
 * @since 1.0.0
 * @category Models
 */
export type FieldRefs<TFields extends Field.FieldsRecord> = FormAtoms.FieldRefs<TFields>

/**
 * Operations available for array fields.
 *
 * @since 1.0.0
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
 * State exposed to form.Subscribe render prop.
 *
 * @since 1.0.0
 * @category Models
 */
export interface SubscribeState<TFields extends Field.FieldsRecord> {
  readonly values: Field.EncodedFromFields<TFields>
  readonly isDirty: boolean
  readonly hasChangedSinceSubmit: boolean
  readonly lastSubmittedValues: Option.Option<Field.EncodedFromFields<TFields>>
  readonly submitResult: Result.Result<unknown, unknown>
  readonly submit: () => void
  readonly reset: () => void
  readonly revertToLastSubmit: () => void
  readonly setValue: <S>(field: Form.Field<S>, update: S | ((prev: S) => S)) => void
  readonly setValues: (values: Field.EncodedFromFields<TFields>) => void
}

/**
 * The result of building a form, containing all components and utilities needed
 * for form rendering and submission.
 *
 * @since 1.0.0
 * @category Models
 */
export type BuiltForm<TFields extends Field.FieldsRecord, R> = {
  readonly atom: Atom.Writable<Option.Option<Form.FormState<TFields>>, Option.Option<Form.FormState<TFields>>>
  readonly schema: Schema.Schema<Field.DecodedFromFields<TFields>, Field.EncodedFromFields<TFields>, R>
  readonly fields: FieldRefs<TFields>

  readonly Form: React.FC<{
    readonly defaultValues: Field.EncodedFromFields<TFields>
    readonly onSubmit: Atom.AtomResultFn<Field.DecodedFromFields<TFields>, unknown, unknown>
    readonly children: React.ReactNode
  }>

  readonly Subscribe: React.FC<{
    readonly children: (state: SubscribeState<TFields>) => React.ReactNode
  }>

  readonly useForm: () => {
    readonly submit: () => void
    readonly reset: () => void
    readonly revertToLastSubmit: () => void
    readonly isDirty: boolean
    readonly hasChangedSinceSubmit: boolean
    readonly lastSubmittedValues: Option.Option<Field.EncodedFromFields<TFields>>
    readonly submitResult: Result.Result<unknown, unknown>
    readonly values: Field.EncodedFromFields<TFields>
    readonly setValue: <S>(field: Form.Field<S>, update: S | ((prev: S) => S)) => void
    readonly setValues: (values: Field.EncodedFromFields<TFields>) => void
  }

  readonly submit: <A>(
    fn: (values: Field.DecodedFromFields<TFields>, get: Atom.FnContext) => A,
  ) => Atom.AtomResultFn<
    Field.DecodedFromFields<TFields>,
    A extends Effect.Effect<infer T, any, any> ? T : A,
    A extends Effect.Effect<any, infer E, any> ? E : never
  >
} & FieldComponents<TFields>

type FieldComponents<TFields extends Field.FieldsRecord> = {
  readonly [K in keyof TFields]: TFields[K] extends Field.FieldDef<any, any> ? React.FC
    : TFields[K] extends Field.ArrayFieldDef<any, infer S> ? ArrayFieldComponent<S>
    : never
}

type ArrayFieldComponent<S extends Schema.Schema.Any> =
  & React.FC<{
    readonly children: (ops: ArrayFieldOperations<Schema.Schema.Encoded<S>>) => React.ReactNode
  }>
  & {
    readonly Item: React.FC<{
      readonly index: number
      readonly children: React.ReactNode | ((props: { readonly remove: () => void }) => React.ReactNode)
    }>
  }
  & (S extends Schema.Struct<infer Fields> ? { readonly [K in keyof Fields]: React.FC }
    : unknown)

interface ArrayItemContextValue {
  readonly index: number
  readonly parentPath: string
}

const ArrayItemContext = createContext<ArrayItemContextValue | null>(null)
const AutoSubmitContext = createContext<(() => void) | null>(null)

const makeFieldComponent = <S extends Schema.Schema.Any>(
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
  Component: React.FC<FieldComponentProps<S>>,
): React.FC => {
  const FieldComponent: React.FC = React.memo(() => {
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
          if (prev.has(fieldPath)) {
            const next = new Map(prev)
            next.delete(fieldPath)
            return next
          }
          return prev
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

    return (
      <Component
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        error={shouldShowError ? validationError : Option.none<string>()}
        isTouched={isTouched}
        isValidating={isValidating}
        isDirty={isDirty}
      />
    )
  })

  return FieldComponent
}

const makeArrayFieldComponent = <S extends Schema.Schema.Any>(
  fieldKey: string,
  def: Field.ArrayFieldDef<string, S>,
  stateAtom: Atom.Writable<Option.Option<Form.FormState<any>>, Option.Option<Form.FormState<any>>>,
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
): ArrayFieldComponent<S> => {
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
      const itemComponent = (componentMap as Record<string, React.FC<FieldComponentProps<any>>>)[itemKey]
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
  }) as ArrayFieldComponent<S>
}

const makeFieldComponents = <TFields extends Field.FieldsRecord>(
  fields: TFields,
  stateAtom: Atom.Writable<Option.Option<Form.FormState<TFields>>, Option.Option<Form.FormState<TFields>>>,
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
  componentMap: FieldComponentMap<TFields>,
): FieldComponents<TFields> => {
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
      const fieldComponent = (componentMap as Record<string, React.FC<FieldComponentProps<any>>>)[key]
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

  return components as FieldComponents<TFields>
}

/**
 * Builds a React form from a FormBuilder.
 *
 * @example
 * ```tsx
 * import { Form } from "@lucas-barake/effect-form"
 * import { FormReact } from "@lucas-barake/effect-form-react"
 * import * as Atom from "@effect-atom/atom/Atom"
 * import * as Schema from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const runtime = Atom.runtime(Layer.empty)
 *
 * const loginForm = Form.empty
 *   .addField("email", Schema.String)
 *   .addField("password", Schema.String)
 *
 * const form = FormReact.build(loginForm, {
 *   runtime,
 *   fields: { email: TextInput, password: PasswordInput },
 * })
 *
 * function LoginDialog({ onClose }) {
 *   const handleSubmit = form.submit((values) =>
 *     Effect.gen(function* () {
 *       yield* saveUser(values)
 *       onClose()
 *     })
 *   )
 *
 *   return (
 *     <form.Form defaultValues={{ email: "", password: "" }} onSubmit={handleSubmit}>
 *       <form.email />
 *       <form.password />
 *       <form.Subscribe>
 *         {({ isDirty, submit }) => (
 *           <button onClick={submit} disabled={!isDirty}>Login</button>
 *         )}
 *       </form.Subscribe>
 *     </form.Form>
 *   )
 * }
 * ```
 *
 * @since 1.0.0
 * @category Constructors
 */
export const build = <TFields extends Field.FieldsRecord, R, ER = never>(
  self: Form.FormBuilder<TFields, R>,
  options: {
    readonly runtime: Atom.AtomRuntime<R, ER>
    readonly fields: FieldComponentMap<TFields>
    readonly mode?: Mode.FormMode
  },
): BuiltForm<TFields, R> => {
  const { fields: components, mode, runtime } = options
  const parsedMode = Mode.parse(mode)
  const { fields } = self

  const formAtoms: FormAtoms.FormAtoms<TFields, R> = FormAtoms.make({
    formBuilder: self,
    runtime,
  })

  const {
    combinedSchema,
    crossFieldErrorsAtom,
    decodeAndSubmit,
    dirtyFieldsAtom,
    fieldRefs,
    getOrCreateFieldAtoms,
    getOrCreateValidationAtom,
    hasChangedSinceSubmitAtom,
    isDirtyAtom,
    lastSubmittedValuesAtom,
    onSubmitAtom,
    operations,
    resetValidationAtoms,
    stateAtom,
    submitCountAtom,
  } = formAtoms

  const FormComponent: React.FC<{
    readonly defaultValues: Field.EncodedFromFields<TFields>
    readonly onSubmit: Atom.AtomResultFn<Field.DecodedFromFields<TFields>, unknown, unknown>
    readonly children: React.ReactNode
  }> = ({ children, defaultValues, onSubmit }) => {
    const registry = React.useContext(RegistryContext)
    const state = useAtomValue(stateAtom)
    const setFormState = useAtomSet(stateAtom)
    const setOnSubmit = useAtomSet(onSubmitAtom)
    const callDecodeAndSubmit = useAtomSet(decodeAndSubmit)

    React.useEffect(() => {
      setOnSubmit(onSubmit)
    }, [onSubmit, setOnSubmit])

    React.useEffect(() => {
      setFormState(Option.some(operations.createInitialState(defaultValues)))
      // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only
    }, [])

    const debouncedAutoSubmit = useDebounced(() => {
      const stateOption = registry.get(stateAtom)
      if (Option.isNone(stateOption)) return
      callDecodeAndSubmit(stateOption.value.values)
    }, parsedMode.autoSubmit && parsedMode.validation === "onChange" ? parsedMode.debounce : null)

    useAtomSubscribe(
      stateAtom,
      React.useCallback(() => {
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
        callDecodeAndSubmit(stateOption.value.values)
      }
    }, [registry, callDecodeAndSubmit])

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

  const useFormHook = () => {
    const registry = React.useContext(RegistryContext)
    const formValues = Option.getOrThrow(useAtomValue(stateAtom)).values
    const setFormState = useAtomSet(stateAtom)
    const setCrossFieldErrors = useAtomSet(crossFieldErrorsAtom)
    const [decodeAndSubmitResult, callDecodeAndSubmit] = useAtom(decodeAndSubmit)
    const isDirty = useAtomValue(isDirtyAtom)
    const hasChangedSinceSubmit = useAtomValue(hasChangedSinceSubmitAtom)
    const lastSubmittedValues = useAtomValue(lastSubmittedValuesAtom)

    React.useEffect(() => {
      if (decodeAndSubmitResult._tag === "Failure") {
        const parseError = Cause.failureOption(decodeAndSubmitResult.cause)
        if (Option.isSome(parseError) && ParseResult.isParseError(parseError.value)) {
          const issues = ParseResult.ArrayFormatter.formatErrorSync(parseError.value)

          const fieldErrors = new Map<string, string>()
          for (const issue of issues) {
            if (issue.path.length > 0) {
              const fieldPath = schemaPathToFieldPath(issue.path)
              if (!fieldErrors.has(fieldPath)) {
                fieldErrors.set(fieldPath, issue.message)
              }
            }
          }

          if (fieldErrors.size > 0) {
            setCrossFieldErrors(fieldErrors)
          }
        }
      }
    }, [decodeAndSubmitResult, setCrossFieldErrors])

    const submit = React.useCallback(() => {
      const stateOption = registry.get(stateAtom)
      if (Option.isNone(stateOption)) return

      setCrossFieldErrors(new Map())

      setFormState((prev) => {
        if (Option.isNone(prev)) return prev
        return Option.some(operations.createSubmitState(prev.value))
      })

      callDecodeAndSubmit(stateOption.value.values)
    }, [setFormState, callDecodeAndSubmit, setCrossFieldErrors, registry])

    const reset = React.useCallback(() => {
      setFormState((prev) => {
        if (Option.isNone(prev)) return prev
        return Option.some(operations.createResetState(prev.value))
      })
      setCrossFieldErrors(new Map())
      resetValidationAtoms(registry)
      callDecodeAndSubmit(Atom.Reset)
    }, [setFormState, setCrossFieldErrors, callDecodeAndSubmit, registry])

    const revertToLastSubmit = React.useCallback(() => {
      setFormState((prev) => {
        if (Option.isNone(prev)) return prev
        return Option.some(operations.revertToLastSubmit(prev.value))
      })
      setCrossFieldErrors(new Map())
    }, [setFormState, setCrossFieldErrors])

    const setValue = React.useCallback(<S,>(
      field: Form.Field<S>,
      update: S | ((prev: S) => S),
    ) => {
      const path = field.key

      setFormState((prev) => {
        if (Option.isNone(prev)) return prev
        const state = prev.value

        const currentValue = getNestedValue(state.values, path) as S
        const newValue = typeof update === "function"
          ? (update as (prev: S) => S)(currentValue)
          : update

        return Option.some(operations.setFieldValue(state, path, newValue))
      })

      setCrossFieldErrors((prev) => {
        let changed = false
        const next = new Map(prev)
        for (const errorPath of prev.keys()) {
          if (errorPath === path || errorPath.startsWith(path + ".") || errorPath.startsWith(path + "[")) {
            next.delete(errorPath)
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, [setFormState, setCrossFieldErrors])

    const setValues = React.useCallback((values: Field.EncodedFromFields<TFields>) => {
      setFormState((prev) => {
        if (Option.isNone(prev)) return prev
        return Option.some(operations.setFormValues(prev.value, values))
      })

      setCrossFieldErrors(new Map())
    }, [setFormState, setCrossFieldErrors])

    return {
      submit,
      reset,
      revertToLastSubmit,
      isDirty,
      hasChangedSinceSubmit,
      lastSubmittedValues,
      submitResult: decodeAndSubmitResult,
      values: formValues,
      setValue,
      setValues,
    }
  }

  const SubscribeComponent: React.FC<{
    readonly children: (state: SubscribeState<TFields>) => React.ReactNode
  }> = ({ children }) => {
    const {
      hasChangedSinceSubmit,
      isDirty,
      lastSubmittedValues,
      reset,
      revertToLastSubmit,
      setValue,
      setValues,
      submit,
      submitResult,
      values,
    } = useFormHook()

    return (
      <>
        {children({
          hasChangedSinceSubmit,
          isDirty,
          lastSubmittedValues,
          reset,
          revertToLastSubmit,
          setValue,
          setValues,
          submit,
          submitResult,
          values,
        })}
      </>
    )
  }

  const submitHelper = <A,>(
    fn: (values: Field.DecodedFromFields<TFields>, get: Atom.FnContext) => A,
  ) =>
    runtime.fn<Field.DecodedFromFields<TFields>>()((values, get) => {
      const result = fn(values, get)
      return (Effect.isEffect(result) ? result : Effect.succeed(result)) as Effect.Effect<
        A extends Effect.Effect<infer T, any, any> ? T : A,
        A extends Effect.Effect<any, infer E, any> ? E : never,
        R
      >
    }) as Atom.AtomResultFn<
      Field.DecodedFromFields<TFields>,
      A extends Effect.Effect<infer T, any, any> ? T : A,
      A extends Effect.Effect<any, infer E, any> ? E : never
    >

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
    atom: stateAtom,
    schema: combinedSchema,
    fields: fieldRefs,
    Form: FormComponent,
    Subscribe: SubscribeComponent,
    useForm: useFormHook,
    submit: submitHelper,
    ...fieldComponents,
  } as BuiltForm<TFields, R>
}
