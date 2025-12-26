/**
 * @since 1.0.0
 */
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import * as Atom from "@effect-atom/atom/Atom"
import { Form } from "@lucas-barake/effect-form"
import * as Cause from "effect/Cause"
import type * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Equal from "effect/Equal"
import { pipe } from "effect/Function"
import * as Option from "effect/Option"
import * as ParseResult from "effect/ParseResult"
import * as Schema from "effect/Schema"
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
    readonly validationMode?: ValidationMode
    readonly children: React.ReactNode
  }>

  readonly useForm: () => {
    readonly submit: () => void
    readonly isDirty: boolean
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

type ValidationAtomRegistry = Map<string, Atom.AtomResultFn<unknown, void, ParseResult.ParseError>>

interface FormContextValue<TFields extends Form.FieldsRecord, R> {
  readonly stateAtom: Atom.Writable<Form.FormState<TFields>, Form.FormState<TFields>>
  readonly onSubmit: Atom.AtomResultFn<Form.DecodedFromFields<TFields>, unknown, unknown>
  readonly schema: Schema.Schema<Form.DecodedFromFields<TFields>, Form.EncodedFromFields<TFields>, R>
  readonly fields: TFields
  readonly components: FieldComponentMap<TFields>
  readonly debounce: Duration.DurationInput
  readonly validationMode: ValidationMode
  readonly crossFieldErrors: Map<string, string>
  readonly setCrossFieldErrors: React.Dispatch<React.SetStateAction<Map<string, string>>>
  readonly getOrCreateValidationAtom: (
    fieldPath: string,
    schema: Schema.Schema.Any,
  ) => Atom.AtomResultFn<unknown, void, ParseResult.ParseError>
  readonly decodeAndSubmit: Atom.AtomResultFn<Form.EncodedFromFields<TFields>, void, ParseResult.ParseError>
}

const FormContext = createContext<FormContextValue<any, any> | null>(null)

interface ArrayItemContextValue {
  readonly index: number
  readonly parentPath: string
}

const ArrayItemContext = createContext<ArrayItemContextValue | null>(null)

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

const makeFieldComponent = <S extends Schema.Schema.Any>(
  fieldKey: string,
  fieldDef: Form.FieldDef<S>,
  stateAtom: Atom.Writable<Form.FormState<any>, any>,
  Component: React.FC<FieldComponentProps<S>>,
): React.FC => {
  const FieldComponent: React.FC = () => {
    const ctx = useContext(FormContext)
    if (!ctx) throw new Error("Field must be used within Form")

    const { crossFieldErrors, getOrCreateValidationAtom, setCrossFieldErrors, validationMode } = ctx
    const arrayCtx = useContext(ArrayItemContext)
    const formState = useAtomValue(stateAtom)
    const setFormState = useAtomSet(stateAtom)

    const fieldPath = arrayCtx ? `${arrayCtx.parentPath}.${fieldKey}` : fieldKey

    const validationAtom = React.useMemo(
      () => getOrCreateValidationAtom(fieldPath, fieldDef.schema),
      [getOrCreateValidationAtom, fieldPath],
    )
    const validationResult = useAtomValue(validationAtom)
    const validate = useAtomSet(validationAtom)

    const value = getNestedValue(formState.values, fieldPath) as Schema.Schema.Encoded<S>
    const initialValue = getNestedValue(formState.initialValues, fieldPath) as Schema.Schema.Encoded<S>
    const isTouched = (getNestedValue(formState.touched, fieldPath) ?? false) as boolean

    const perFieldError: Option.Option<string> = React.useMemo(() => {
      if (validationResult._tag === "Failure") {
        const parseError = Cause.failureOption(validationResult.cause)
        if (Option.isSome(parseError) && ParseResult.isParseError(parseError.value)) {
          return extractFirstError(parseError.value)
        }
      }
      return Option.none()
    }, [validationResult])

    const crossFieldError: Option.Option<string> = React.useMemo(() => {
      const error = crossFieldErrors.get(fieldPath)
      return error !== undefined ? Option.some(error) : Option.none()
    }, [crossFieldErrors, fieldPath])

    const validationError = Option.isSome(perFieldError) ? perFieldError : crossFieldError

    const onChange = React.useCallback(
      (newValue: Schema.Schema.Encoded<S>) => {
        setFormState((prev: Form.FormState<any>) => ({
          ...prev,
          values: setNestedValue(prev.values, fieldPath, newValue),
        }))
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
      [fieldPath, setFormState, setCrossFieldErrors, validationMode, validate],
    )

    const onBlur = React.useCallback(() => {
      setFormState((prev: Form.FormState<any>) => ({
        ...prev,
        touched: setNestedValue(prev.touched, fieldPath, true),
      }))
      if (validationMode === "onBlur") {
        validate(value)
      }
    }, [fieldPath, setFormState, validationMode, validate, value])

    const isDirty = !Equal.equals(value, initialValue)
    const isValidating = validationResult.waiting

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

const makeArrayFieldComponent = <TItemFields extends Form.FieldsRecord>(
  fieldKey: string,
  def: Form.ArrayFieldDef<Form.FormBuilder<TItemFields, any>>,
  stateAtom: Atom.Writable<Form.FormState<any>, any>,
  componentMap: FieldComponentMap<TItemFields>,
): ArrayFieldComponent<TItemFields> => {
  const ArrayWrapper: React.FC<{
    readonly children: (ops: ArrayFieldOperations<Form.EncodedFromFields<TItemFields>>) => React.ReactNode
  }> = ({ children }) => {
    const ctx = useContext(FormContext)
    if (!ctx) throw new Error("Array field must be used within Form")

    const arrayCtx = useContext(ArrayItemContext)
    const formState = useAtomValue(stateAtom)
    const setFormState = useAtomSet(stateAtom)

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
        setFormState((prev: Form.FormState<any>) => ({
          ...prev,
          values: setNestedValue(prev.values, fieldPath, [...items, newItem]),
        }))
      },
      [fieldPath, items, setFormState],
    )

    const remove = React.useCallback(
      (index: number) => {
        setFormState((prev: Form.FormState<any>) => ({
          ...prev,
          values: setNestedValue(
            prev.values,
            fieldPath,
            items.filter((_, i) => i !== index),
          ),
        }))
      },
      [fieldPath, items, setFormState],
    )

    const swap = React.useCallback(
      (indexA: number, indexB: number) => {
        const newItems = [...items]
        const temp = newItems[indexA]
        newItems[indexA] = newItems[indexB]
        newItems[indexB] = temp
        setFormState((prev: Form.FormState<any>) => ({
          ...prev,
          values: setNestedValue(prev.values, fieldPath, newItems),
        }))
      },
      [fieldPath, items, setFormState],
    )

    const move = React.useCallback(
      (from: number, to: number) => {
        const newItems = [...items]
        const [item] = newItems.splice(from, 1)
        newItems.splice(to, 0, item)
        setFormState((prev: Form.FormState<any>) => ({
          ...prev,
          values: setNestedValue(prev.values, fieldPath, newItems),
        }))
      },
      [fieldPath, items, setFormState],
    )

    return <>{children({ items, append, remove, swap, move })}</>
  }

  const ItemWrapper: React.FC<{
    readonly index: number
    readonly children: React.ReactNode | ((props: { readonly remove: () => void }) => React.ReactNode)
  }> = ({ children, index }) => {
    const ctx = useContext(FormContext)
    if (!ctx) throw new Error("Item must be used within Form")

    const arrayCtx = useContext(ArrayItemContext)
    const setFormState = useAtomSet(stateAtom)
    const formState = useAtomValue(stateAtom)

    const parentPath = arrayCtx ? `${arrayCtx.parentPath}.${fieldKey}` : fieldKey
    const itemPath = `${parentPath}[${index}]`

    const items = React.useMemo(
      () => getNestedValue(formState.values, parentPath) ?? [],
      [formState.values, parentPath],
    )

    const remove = React.useCallback(() => {
      setFormState((prev: Form.FormState<any>) => ({
        ...prev,
        values: setNestedValue(
          prev.values,
          parentPath,
          (items as Array<any>).filter((_, i) => i !== index),
        ),
      }))
    }, [parentPath, items, index, setFormState])

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
      itemFieldComponents[itemKey] = makeFieldComponent(itemKey, itemDef, stateAtom, itemComponent)
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

const makeFieldComponents = <TFields extends Form.FieldsRecord>(
  fields: TFields,
  stateAtom: Atom.Writable<Form.FormState<TFields>, any>,
  componentMap: FieldComponentMap<TFields>,
): FieldComponents<TFields> => {
  const components: Record<string, any> = {}

  for (const [key, def] of Object.entries(fields)) {
    if (Form.isArrayFieldDef(def)) {
      const arrayComponentMap = (componentMap as Record<string, FieldComponentMap<any>>)[key]
      components[key] = makeArrayFieldComponent(key, def, stateAtom, arrayComponentMap)
    } else if (Form.isFieldDef(def)) {
      const fieldComponent = (componentMap as Record<string, React.FC<FieldComponentProps<any>>>)[key]
      components[key] = makeFieldComponent(key, def, stateAtom, fieldComponent)
    }
  }

  return components as FieldComponents<TFields>
}

/**
 * Builds a React form from a FormBuilder.
 *
 * **Details**
 *
 * This function takes a form definition, runtime, and component map, producing:
 * - A `Form` wrapper component for context provision
 * - Individual field components for each defined field
 * - A `useForm` hook for form-level operations
 * - A `submit` helper for creating typed submission handlers
 *
 * @example
 * ```tsx
 * import { Form, FormReact } from "@lucas-barake/effect-form-react"
 * import * as Atom from "@effect-atom/atom/Atom"
 * import * as Schema from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const runtime = Atom.runtime(Layer.empty)
 *
 * const loginBuilder = Form.addField(
 *   Form.addField(Form.empty, "email", Schema.String),
 *   "password",
 *   Schema.String
 * )
 *
 * const loginForm = FormReact.build(loginBuilder, {
 *   runtime,
 *   fields: {
 *     email: TextInput,
 *     password: PasswordInput,
 *   }
 * })
 *
 * const handleSubmit = loginForm.submit(
 *   (values) => Effect.log(`Login: ${values.email}`)
 * )
 *
 * function LoginPage() {
 *   const { submit, isDirty } = loginForm.useForm()
 *
 *   return (
 *     <loginForm.Form
 *       defaultValues={{ email: "", password: "" }}
 *       onSubmit={handleSubmit}
 *     >
 *       <loginForm.email />
 *       <loginForm.password />
 *       <button onClick={submit} disabled={!isDirty}>
 *         Login
 *       </button>
 *     </loginForm.Form>
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
  },
): BuiltForm<TFields, R> => {
  const { fields: components, runtime } = options
  const { fields } = self

  const combinedSchema = Form.buildSchema(self)

  const initialState: Form.FormState<TFields> = {
    values: Form.getDefaultEncodedValues(fields) as Form.EncodedFromFields<TFields>,
    initialValues: Form.getDefaultEncodedValues(fields) as Form.EncodedFromFields<TFields>,
    touched: Form.createTouchedRecord(fields, false) as { readonly [K in keyof TFields]: boolean },
    submitCount: 0,
  }

  const stateAtom = Atom.make(initialState)

  const FormComponent: React.FC<{
    readonly defaultValues: Form.EncodedFromFields<TFields>
    readonly onSubmit: Atom.AtomResultFn<Form.DecodedFromFields<TFields>, unknown, unknown>
    readonly debounce?: Duration.DurationInput
    readonly validationMode?: ValidationMode
    readonly children: React.ReactNode
  }> = ({ children, debounce = "300 millis", defaultValues, onSubmit, validationMode = "onSubmit" }) => {
    const setFormState = useAtomSet(stateAtom)
    const [crossFieldErrors, setCrossFieldErrors] = React.useState<Map<string, string>>(() => new Map())

    React.useEffect(() => {
      setFormState({
        values: defaultValues,
        initialValues: defaultValues,
        touched: Form.createTouchedRecord(fields, false) as { readonly [K in keyof TFields]: boolean },
        submitCount: 0,
      })
      // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only initialization
    }, [])

    const validationAtomsRef = React.useRef<ValidationAtomRegistry>(new Map())

    const getOrCreateValidationAtom = React.useCallback(
      (fieldPath: string, schema: Schema.Schema.Any): Atom.AtomResultFn<unknown, void, ParseResult.ParseError> => {
        const existing = validationAtomsRef.current.get(fieldPath)
        if (existing) return existing

        const validationAtom = runtime.fn<unknown>()((value: unknown) =>
          pipe(
            Schema.decodeUnknown(schema)(value) as Effect.Effect<unknown, ParseResult.ParseError, R>,
            Effect.asVoid,
          )
        ) as Atom.AtomResultFn<unknown, void, ParseResult.ParseError>

        validationAtomsRef.current.set(fieldPath, validationAtom)
        return validationAtom
      },
      [],
    )

    const decodeAndSubmit = React.useMemo(
      () =>
        runtime.fn<Form.EncodedFromFields<TFields>>()((values, get) =>
          pipe(
            Schema.decodeUnknown(combinedSchema)(values) as Effect.Effect<
              Form.DecodedFromFields<TFields>,
              ParseResult.ParseError,
              R
            >,
            Effect.andThen((decoded) => get.set(onSubmit, decoded)),
            Effect.asVoid,
          )
        ) as Atom.AtomResultFn<Form.EncodedFromFields<TFields>, void, ParseResult.ParseError>,
      [onSubmit],
    )

    const contextValue = React.useMemo<FormContextValue<TFields, R>>(
      () => ({
        stateAtom,
        onSubmit,
        schema: combinedSchema,
        fields,
        components,
        debounce,
        validationMode,
        crossFieldErrors,
        setCrossFieldErrors,
        getOrCreateValidationAtom,
        decodeAndSubmit,
      }),
      [onSubmit, debounce, validationMode, crossFieldErrors, getOrCreateValidationAtom, decodeAndSubmit],
    )

    return (
      <FormContext.Provider value={contextValue}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
        >
          {children}
        </form>
      </FormContext.Provider>
    )
  }

  const useFormHook = () => {
    const ctx = useContext(FormContext)
    if (!ctx) throw new Error("useForm must be used within Form")

    const { fields: ctxFields, setCrossFieldErrors } = ctx
    const formState = useAtomValue(ctx.stateAtom)
    const setFormState = useAtomSet(ctx.stateAtom)
    const callDecodeAndSubmit = useAtomSet(ctx.decodeAndSubmit)
    const decodeAndSubmitResult = useAtomValue(ctx.decodeAndSubmit)

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
        touched: Form.createTouchedRecord(ctxFields, true) as { readonly [K in keyof TFields]: boolean },
      }))

      callDecodeAndSubmit(formState.values)
    }, [formState.values, setFormState, callDecodeAndSubmit, setCrossFieldErrors, ctxFields])

    const isDirty = !Equal.equals(formState.values, formState.initialValues)

    return { submit, isDirty }
  }

  const submitHelper = <A, E>(
    fn: (values: Form.DecodedFromFields<TFields>, get: Atom.FnContext) => Effect.Effect<A, E, R>,
  ) => runtime.fn<Form.DecodedFromFields<TFields>>()(fn) as Atom.AtomResultFn<Form.DecodedFromFields<TFields>, A, E>

  const fieldComponents = makeFieldComponents(fields, stateAtom, components)

  return {
    atom: stateAtom,
    schema: combinedSchema,
    Form: FormComponent,
    useForm: useFormHook,
    submit: submitHelper,
    ...fieldComponents,
  } as BuiltForm<TFields, R>
}
