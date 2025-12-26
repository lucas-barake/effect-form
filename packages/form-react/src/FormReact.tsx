/**
 * @since 1.0.0
 */
import { RegistryContext, useAtom, useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import * as Atom from "@effect-atom/atom/Atom"
import type * as Registry from "@effect-atom/atom/Registry"
import type * as Result from "@effect-atom/atom/Result"
import { Form } from "@lucas-barake/effect-form"
import * as Cause from "effect/Cause"
import type * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Equal from "effect/Equal"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as ParseResult from "effect/ParseResult"
import * as Schema from "effect/Schema"
import * as Utils from "effect/Utils"
import * as React from "react"
import { createContext, useContext } from "react"

// ================================
// Validation Mode
// ================================

/**
 * Controls when field validation is triggered.
 *
 * - `"onSubmit"`: Validation only runs when the form is submitted (default)
 * - `"onBlur"`: Validation runs when a field loses focus
 * - `"onChange"`: Validation runs on every value change
 *
 * @since 1.0.0
 * @category Models
 */
export type ValidationMode = "onChange" | "onBlur" | "onSubmit"

// ================================
// Field Component Props
// ================================

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

// ================================
// Component Map Type
// ================================

/**
 * Maps field names to their React components.
 *
 * @since 1.0.0
 * @category Models
 */
export type FieldComponentMap<TFields extends Form.FieldsRecord> = {
  readonly [K in keyof TFields]: TFields[K] extends Form.FieldDef<infer S> ? React.FC<FieldComponentProps<S>>
    : TFields[K] extends Form.ArrayFieldDef<infer F> ? FieldComponentMap<F["fields"]>
    : never
}

// ================================
// Array Field Operations
// ================================

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

// ================================
// Subscribe State
// ================================

/**
 * State exposed to form.Subscribe render prop.
 *
 * @since 1.0.0
 * @category Models
 */
export interface SubscribeState<TFields extends Form.FieldsRecord> {
  readonly values: Form.EncodedFromFields<TFields>
  readonly isDirty: boolean
  readonly submitResult: Result.Result<unknown, unknown>
  readonly submit: () => void
  readonly reset: () => void
}

// ================================
// Built Form Type
// ================================

/**
 * The result of building a form, containing all components and utilities needed
 * for form rendering and submission.
 *
 * @since 1.0.0
 * @category Models
 */
export type BuiltForm<TFields extends Form.FieldsRecord, R> = {
  readonly atom: Atom.Writable<Form.FormState<TFields>, Form.FormState<TFields>>
  readonly schema: Schema.Schema<Form.DecodedFromFields<TFields>, Form.EncodedFromFields<TFields>, R>

  readonly Form: React.FC<{
    readonly defaultValues: Form.EncodedFromFields<TFields>
    readonly onSubmit: Atom.AtomResultFn<Form.DecodedFromFields<TFields>, unknown, unknown>
    readonly debounce?: Duration.DurationInput
    readonly children: React.ReactNode
  }>

  readonly Subscribe: React.FC<{
    readonly children: (state: SubscribeState<TFields>) => React.ReactNode
  }>

  readonly useForm: () => {
    readonly submit: () => void
    readonly reset: () => void
    readonly isDirty: boolean
    readonly submitResult: Result.Result<unknown, unknown>
    readonly values: Form.EncodedFromFields<TFields>
  }

  readonly submit: <A, E>(
    fn: (values: Form.DecodedFromFields<TFields>, get: Atom.FnContext) => Effect.Effect<A, E, R>,
  ) => Atom.AtomResultFn<Form.DecodedFromFields<TFields>, A, E>
} & FieldComponents<TFields>

type FieldComponents<TFields extends Form.FieldsRecord> = {
  readonly [K in keyof TFields]: TFields[K] extends Form.FieldDef<any> ? React.FC
    : TFields[K] extends Form.ArrayFieldDef<infer F>
      ? ArrayFieldComponent<F extends Form.FormBuilder<infer IF, any> ? IF : never>
    : never
}

interface ArrayFieldComponent<TItemFields extends Form.FieldsRecord> extends
  React.FC<{
    readonly children: (ops: ArrayFieldOperations<Form.EncodedFromFields<TItemFields>>) => React.ReactNode
  }>
{
  readonly Item: React.FC<{
    readonly index: number
    readonly children: React.ReactNode | ((props: { readonly remove: () => void }) => React.ReactNode)
  }>
}

// ================================
// Internal Types
// ================================

type ValidationAtomRegistry = Map<string, Atom.AtomResultFn<unknown, void, ParseResult.ParseError>>

interface FieldAtoms {
  readonly valueAtom: Atom.Writable<unknown, unknown>
  readonly initialValueAtom: Atom.Atom<unknown>
  readonly touchedAtom: Atom.Writable<boolean, boolean>
  readonly crossFieldErrorAtom: Atom.Atom<Option.Option<string>>
}

type FieldAtomRegistry = Map<string, FieldAtoms>

interface ArrayItemContextValue {
  readonly index: number
  readonly parentPath: string
}

const ArrayItemContext = createContext<ArrayItemContextValue | null>(null)

// ================================
// Utilities
// ================================

const getNestedValue = (obj: unknown, path: string): unknown => {
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".")
  let current: any = obj
  for (const part of parts) {
    if (current == null) return undefined
    current = current[part]
  }
  return current
}

const setNestedValue = <T,>(obj: T, path: string, value: unknown): T => {
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".")
  const result = { ...obj } as any

  let current = result
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (Array.isArray(current[part])) {
      current[part] = [...current[part]]
    } else {
      current[part] = { ...current[part] }
    }
    current = current[part]
  }

  current[parts[parts.length - 1]] = value
  return result
}

const extractFirstError = (error: ParseResult.ParseError): Option.Option<string> => {
  const issues = ParseResult.ArrayFormatter.formatErrorSync(error)
  if (issues.length === 0) {
    return Option.none()
  }
  return Option.some(issues[0].message)
}

// ================================
// Field Component Factory
// ================================

const makeFieldComponent = <S extends Schema.Schema.Any>(
  fieldKey: string,
  fieldDef: Form.FieldDef<S>,
  crossFieldErrorsAtom: Atom.Writable<Map<string, string>, Map<string, string>>,
  validationMode: ValidationMode,
  getOrCreateValidationAtom: (
    fieldPath: string,
    schema: Schema.Schema.Any,
  ) => Atom.AtomResultFn<unknown, void, ParseResult.ParseError>,
  getOrCreateFieldAtoms: (fieldPath: string) => FieldAtoms,
  Component: React.FC<FieldComponentProps<S>>,
): React.FC => {
  const FieldComponent: React.FC = () => {
    const arrayCtx = useContext(ArrayItemContext)
    const fieldPath = arrayCtx ? `${arrayCtx.parentPath}.${fieldKey}` : fieldKey

    // Get per-field atoms for fine-grained subscriptions
    const { crossFieldErrorAtom, initialValueAtom, touchedAtom, valueAtom } = React.useMemo(
      () => getOrCreateFieldAtoms(fieldPath),
      [fieldPath],
    )

    const [value, setValue] = useAtom(valueAtom) as [Schema.Schema.Encoded<S>, (v: unknown) => void]
    const initialValue = useAtomValue(initialValueAtom) as Schema.Schema.Encoded<S>
    const [isTouched, setTouched] = useAtom(touchedAtom)
    const crossFieldError = useAtomValue(crossFieldErrorAtom)
    const setCrossFieldErrors = useAtomSet(crossFieldErrorsAtom)

    const validationAtom = React.useMemo(
      () => getOrCreateValidationAtom(fieldPath, fieldDef.schema),
      [fieldPath],
    )
    const validationResult = useAtomValue(validationAtom)
    const validate = useAtomSet(validationAtom)

    const perFieldError: Option.Option<string> = React.useMemo(() => {
      if (validationResult._tag === "Failure") {
        const parseError = Cause.failureOption(validationResult.cause)
        if (Option.isSome(parseError) && ParseResult.isParseError(parseError.value)) {
          return extractFirstError(parseError.value)
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
        if (validationMode === "onChange") {
          validate(newValue)
        }
      },
      [fieldPath, setValue, setCrossFieldErrors, validate],
    )

    const onBlur = React.useCallback(() => {
      setTouched(true)
      if (validationMode === "onBlur") {
        validate(value)
      }
    }, [setTouched, validate, value])

    const isDirty = !Equal.equals(value, initialValue)
    const isValidating = validationResult.waiting

    // Validation errors only show after field is touched to avoid premature error display on load
    return (
      <Component
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        error={isTouched ? validationError : Option.none<string>()}
        isTouched={isTouched}
        isValidating={isValidating}
        isDirty={isDirty}
      />
    )
  }

  return FieldComponent
}

// ================================
// Array Field Component Factory
// ================================

const makeArrayFieldComponent = <TItemFields extends Form.FieldsRecord>(
  fieldKey: string,
  def: Form.ArrayFieldDef<Form.FormBuilder<TItemFields, any>>,
  stateAtom: Atom.Writable<Form.FormState<any>, any>,
  crossFieldErrorsAtom: Atom.Writable<Map<string, string>, Map<string, string>>,
  validationMode: ValidationMode,
  getOrCreateValidationAtom: (
    fieldPath: string,
    schema: Schema.Schema.Any,
  ) => Atom.AtomResultFn<unknown, void, ParseResult.ParseError>,
  getOrCreateFieldAtoms: (fieldPath: string) => FieldAtoms,
  componentMap: FieldComponentMap<TItemFields>,
): ArrayFieldComponent<TItemFields> => {
  const ArrayWrapper: React.FC<{
    readonly children: (ops: ArrayFieldOperations<Form.EncodedFromFields<TItemFields>>) => React.ReactNode
  }> = ({ children }) => {
    const arrayCtx = useContext(ArrayItemContext)
    const [formState, setFormState] = useAtom(stateAtom)

    const fieldPath = arrayCtx ? `${arrayCtx.parentPath}.${fieldKey}` : fieldKey
    const items = React.useMemo(
      () => (getNestedValue(formState.values, fieldPath) ?? []) as ReadonlyArray<Form.EncodedFromFields<TItemFields>>,
      [formState.values, fieldPath],
    )

    const append = React.useCallback(
      (value?: Form.EncodedFromFields<TItemFields>) => {
        const newItem = (value ?? Form.getDefaultEncodedValues(def.itemForm.fields)) as Form.EncodedFromFields<
          TItemFields
        >
        setFormState((prev: Form.FormState<any>) => {
          const currentItems = (getNestedValue(prev.values, fieldPath) ?? []) as ReadonlyArray<
            Form.EncodedFromFields<TItemFields>
          >
          return {
            ...prev,
            values: setNestedValue(prev.values, fieldPath, [...currentItems, newItem]),
          }
        })
      },
      [fieldPath, setFormState],
    )

    const remove = React.useCallback(
      (index: number) => {
        setFormState((prev: Form.FormState<any>) => {
          const currentItems = (getNestedValue(prev.values, fieldPath) ?? []) as ReadonlyArray<
            Form.EncodedFromFields<TItemFields>
          >
          return {
            ...prev,
            values: setNestedValue(
              prev.values,
              fieldPath,
              currentItems.filter((_, i) => i !== index),
            ),
          }
        })
      },
      [fieldPath, setFormState],
    )

    const swap = React.useCallback(
      (indexA: number, indexB: number) => {
        setFormState((prev: Form.FormState<any>) => {
          const currentItems = (getNestedValue(prev.values, fieldPath) ?? []) as ReadonlyArray<
            Form.EncodedFromFields<TItemFields>
          >
          const newItems = [...currentItems]
          const temp = newItems[indexA]
          newItems[indexA] = newItems[indexB]
          newItems[indexB] = temp
          return {
            ...prev,
            values: setNestedValue(prev.values, fieldPath, newItems),
          }
        })
      },
      [fieldPath, setFormState],
    )

    const move = React.useCallback(
      (from: number, to: number) => {
        setFormState((prev: Form.FormState<any>) => {
          const currentItems = (getNestedValue(prev.values, fieldPath) ?? []) as ReadonlyArray<
            Form.EncodedFromFields<TItemFields>
          >
          const newItems = [...currentItems]
          const [item] = newItems.splice(from, 1)
          newItems.splice(to, 0, item)
          return {
            ...prev,
            values: setNestedValue(prev.values, fieldPath, newItems),
          }
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
      setFormState((prev: Form.FormState<any>) => {
        const currentItems = (getNestedValue(prev.values, parentPath) ?? []) as Array<any>
        return {
          ...prev,
          values: setNestedValue(
            prev.values,
            parentPath,
            currentItems.filter((_, i) => i !== index),
          ),
        }
      })
    }, [parentPath, index, setFormState])

    return (
      <ArrayItemContext.Provider value={{ index, parentPath: itemPath }}>
        {typeof children === "function" ? children({ remove }) : children}
      </ArrayItemContext.Provider>
    )
  }

  const itemFieldComponents: Record<string, React.FC> = {}
  for (const [itemKey, itemDef] of Object.entries(def.itemForm.fields)) {
    if (Form.isFieldDef(itemDef)) {
      const itemComponent = (componentMap as Record<string, React.FC<FieldComponentProps<any>>>)[itemKey]
      itemFieldComponents[itemKey] = makeFieldComponent(
        itemKey,
        itemDef,
        crossFieldErrorsAtom,
        validationMode,
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
  }) as ArrayFieldComponent<TItemFields>
}

// ================================
// Field Components Factory
// ================================

const makeFieldComponents = <TFields extends Form.FieldsRecord>(
  fields: TFields,
  stateAtom: Atom.Writable<Form.FormState<TFields>, any>,
  crossFieldErrorsAtom: Atom.Writable<Map<string, string>, Map<string, string>>,
  validationMode: ValidationMode,
  getOrCreateValidationAtom: (
    fieldPath: string,
    schema: Schema.Schema.Any,
  ) => Atom.AtomResultFn<unknown, void, ParseResult.ParseError>,
  getOrCreateFieldAtoms: (fieldPath: string) => FieldAtoms,
  componentMap: FieldComponentMap<TFields>,
): FieldComponents<TFields> => {
  const components: Record<string, any> = {}

  for (const [key, def] of Object.entries(fields)) {
    if (Form.isArrayFieldDef(def)) {
      const arrayComponentMap = (componentMap as Record<string, FieldComponentMap<any>>)[key]
      components[key] = makeArrayFieldComponent(
        key,
        def,
        stateAtom,
        crossFieldErrorsAtom,
        validationMode,
        getOrCreateValidationAtom,
        getOrCreateFieldAtoms,
        arrayComponentMap,
      )
    } else if (Form.isFieldDef(def)) {
      const fieldComponent = (componentMap as Record<string, React.FC<FieldComponentProps<any>>>)[key]
      components[key] = makeFieldComponent(
        key,
        def,
        crossFieldErrorsAtom,
        validationMode,
        getOrCreateValidationAtom,
        getOrCreateFieldAtoms,
        fieldComponent,
      )
    }
  }

  return components as FieldComponents<TFields>
}

// ================================
// Build Function
// ================================

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
export const build = <TFields extends Form.FieldsRecord, R, ER = never>(
  self: Form.FormBuilder<TFields, R>,
  options: {
    readonly runtime: Atom.AtomRuntime<R, ER>
    readonly fields: FieldComponentMap<TFields>
    readonly validationMode?: ValidationMode
  },
): BuiltForm<TFields, R> => {
  const { fields: components, runtime, validationMode = "onSubmit" } = options
  const { fields } = self

  const combinedSchema = Form.buildSchema(self)

  const initialState: Form.FormState<TFields> = {
    values: Form.getDefaultEncodedValues(fields) as Form.EncodedFromFields<TFields>,
    initialValues: Form.getDefaultEncodedValues(fields) as Form.EncodedFromFields<TFields>,
    touched: Form.createTouchedRecord(fields, false) as { readonly [K in keyof TFields]: boolean },
    submitCount: 0,
  }

  const stateAtom = Atom.make(initialState).pipe(Atom.setIdleTTL(0))
  const crossFieldErrorsAtom = Atom.make<Map<string, string>>(new Map()).pipe(Atom.setIdleTTL(0))

  // Derived atom for isDirty - memoized at atom level, only recomputes when state changes
  // structuralRegion enables deep structural equality for nested objects
  const isDirtyAtom = Atom.readable((get) => {
    const state = get(stateAtom)
    return !Utils.structuralRegion(() => Equal.equals(state.values, state.initialValues))
  }).pipe(Atom.setIdleTTL(0))
  const onSubmitAtom = Atom.make<Atom.AtomResultFn<Form.DecodedFromFields<TFields>, unknown, unknown> | null>(null)
    .pipe(Atom.setIdleTTL(0))

  const validationAtomsRegistry: ValidationAtomRegistry = new Map()
  const fieldAtomsRegistry: FieldAtomRegistry = new Map()

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
      (get) => getNestedValue(get(stateAtom).values, fieldPath),
      (ctx, value) => {
        const currentState = ctx.get(stateAtom)
        ctx.set(stateAtom, {
          ...currentState,
          values: setNestedValue(currentState.values, fieldPath, value),
        })
      },
    ).pipe(Atom.setIdleTTL(0))

    const initialValueAtom = Atom.readable(
      (get) => getNestedValue(get(stateAtom).initialValues, fieldPath),
    ).pipe(Atom.setIdleTTL(0))

    const touchedAtom = Atom.writable(
      (get) => (getNestedValue(get(stateAtom).touched, fieldPath) ?? false) as boolean,
      (ctx, value) => {
        const currentState = ctx.get(stateAtom)
        ctx.set(stateAtom, {
          ...currentState,
          touched: setNestedValue(currentState.touched, fieldPath, value),
        })
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
    // Reset each validation atom to clear any errors
    // This writes Atom.Reset which sets the internal counter to 0,
    // causing the atom to return Result.initial() on next read
    for (const validationAtom of validationAtomsRegistry.values()) {
      registry.set(validationAtom, Atom.Reset)
    }
    // Clear registries so new atoms are created on next access
    // Old atoms will be garbage collected due to setIdleTTL(0)
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

  const FormComponent: React.FC<{
    readonly defaultValues: Form.EncodedFromFields<TFields>
    readonly onSubmit: Atom.AtomResultFn<Form.DecodedFromFields<TFields>, unknown, unknown>
    readonly debounce?: Duration.DurationInput
    readonly children: React.ReactNode
  }> = ({ children, defaultValues, onSubmit }) => {
    const setFormState = useAtomSet(stateAtom)
    const setOnSubmit = useAtomSet(onSubmitAtom)

    React.useEffect(() => {
      setOnSubmit(onSubmit)
    }, [onSubmit, setOnSubmit])

    React.useEffect(() => {
      setFormState({
        values: defaultValues,
        initialValues: defaultValues,
        touched: Form.createTouchedRecord(fields, false) as { readonly [K in keyof TFields]: boolean },
        submitCount: 0,
      })
      // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only initialization
    }, [])

    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        {children}
      </form>
    )
  }

  const useFormHook = () => {
    const registry = React.useContext(RegistryContext)
    const formValues = useAtomValue(stateAtom).values
    const setFormState = useAtomSet(stateAtom)
    const setCrossFieldErrors = useAtomSet(crossFieldErrorsAtom)
    const [decodeAndSubmitResult, callDecodeAndSubmit] = useAtom(decodeAndSubmit)
    const isDirty = useAtomValue(isDirtyAtom)

    React.useEffect(() => {
      if (decodeAndSubmitResult._tag === "Failure") {
        const parseError = Cause.failureOption(decodeAndSubmitResult.cause)
        if (Option.isSome(parseError) && ParseResult.isParseError(parseError.value)) {
          const issues = ParseResult.ArrayFormatter.formatErrorSync(parseError.value)

          const fieldErrors = new Map<string, string>()
          for (const issue of issues) {
            if (issue.path.length > 0) {
              const fieldPath = String(issue.path[0])
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
      setCrossFieldErrors(new Map())

      setFormState((prev: Form.FormState<any>) => ({
        ...prev,
        touched: Form.createTouchedRecord(fields, true) as { readonly [K in keyof TFields]: boolean },
      }))

      callDecodeAndSubmit(formValues)
    }, [formValues, setFormState, callDecodeAndSubmit, setCrossFieldErrors])

    const reset = React.useCallback(() => {
      setFormState((prev: Form.FormState<any>) => ({
        values: prev.initialValues,
        initialValues: prev.initialValues,
        touched: Form.createTouchedRecord(fields, false) as { readonly [K in keyof TFields]: boolean },
        submitCount: 0,
      }))
      setCrossFieldErrors(new Map())
      resetValidationAtoms(registry)
      callDecodeAndSubmit(Atom.Reset)
    }, [setFormState, setCrossFieldErrors, callDecodeAndSubmit, registry])

    return { submit, reset, isDirty, submitResult: decodeAndSubmitResult, values: formValues }
  }

  const SubscribeComponent: React.FC<{
    readonly children: (state: SubscribeState<TFields>) => React.ReactNode
  }> = ({ children }) => {
    const { isDirty, reset, submit, submitResult, values } = useFormHook()

    return <>{children({ values, isDirty, submitResult, submit, reset })}</>
  }

  const submitHelper = <A, E>(
    fn: (values: Form.DecodedFromFields<TFields>, get: Atom.FnContext) => Effect.Effect<A, E, R>,
  ) => runtime.fn<Form.DecodedFromFields<TFields>>()(fn) as Atom.AtomResultFn<Form.DecodedFromFields<TFields>, A, E>

  const fieldComponents = makeFieldComponents(
    fields,
    stateAtom,
    crossFieldErrorsAtom,
    validationMode,
    getOrCreateValidationAtom,
    getOrCreateFieldAtoms,
    components,
  )

  return {
    atom: stateAtom,
    schema: combinedSchema,
    Form: FormComponent,
    Subscribe: SubscribeComponent,
    useForm: useFormHook,
    submit: submitHelper,
    ...fieldComponents,
  } as BuiltForm<TFields, R>
}
