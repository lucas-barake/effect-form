import { RegistryContext, useAtom, useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react"
import { Field, FormAtoms } from "@lucas-barake/effect-form"
import type { FieldState as FieldStateModule, Mode } from "@lucas-barake/effect-form"
import type * as FormBuilder from "@lucas-barake/effect-form/FormBuilder"
import { getNestedValue } from "@lucas-barake/effect-form/Path"
import type * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import type * as Schema from "effect/Schema"
import * as Atom from "effect/unstable/reactivity/Atom"
import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"
import * as React from "react"
import { createContext, useContext } from "react"

export type FieldValue<T,> = FieldStateModule.FieldValue<T>

export type FieldState<E,> = FieldStateModule.FieldState<E>

export type ArrayFieldOperations<TItem,> = FieldStateModule.ArrayFieldOperations<TItem>

export interface FieldComponentProps<E, P = Record<string, never>,> {
  readonly field: FieldState<E>
  readonly props: P
}

export type FieldComponent<T, P = Record<string, never>,> = React.FC<FieldComponentProps<FieldValue<T>, P>>

export type ExtractExtraProps<C,> = C extends React.FC<FieldComponentProps<any, infer P>> ? P : Record<string, never>

type StructFieldsFromSchema<S,> = S extends Schema.Struct<infer Fields> ? Fields
  : S extends { readonly from: infer From } ? StructFieldsFromSchema<From>
  : never

export type ArrayItemComponentMap<S extends Schema.Top,> = StructFieldsFromSchema<S> extends Schema.Struct.Fields ? {
    readonly [K in keyof StructFieldsFromSchema<S>]: StructFieldsFromSchema<S>[K] extends Schema.Top
      ? React.FC<FieldComponentProps<Schema.Codec.Encoded<StructFieldsFromSchema<S>[K]>, any>>
      : never
  }
  : React.FC<FieldComponentProps<Schema.Codec.Encoded<S>, any>>

export type FieldComponentMap<TFields extends Field.FieldsRecord,> = {
  readonly [K in keyof TFields]: TFields[K] extends Field.FieldDef<any, infer S>
    ? React.FC<FieldComponentProps<Schema.Codec.Encoded<S>, any>>
    : TFields[K] extends Field.ArrayFieldDef<any, infer S> ? ArrayItemComponentMap<S>
    : never
}

export type FieldRefs<TFields extends Field.FieldsRecord,> = FormAtoms.FieldRefs<TFields>

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
  readonly validationCount: Atom.Atom<number>

  readonly schema: Schema.Codec<Field.DecodedFromFields<TFields>, Field.EncodedFromFields<TFields>, R>
  readonly fields: FieldRefs<TFields>

  readonly Initialize: React.FC<{
    readonly defaultValues: Field.EncodedFromFields<TFields>
    readonly validateOnInit?: boolean
    readonly children: React.ReactNode
  }>

  readonly submit: Atom.AtomResultFn<SubmitArgs, A, E | Schema.SchemaError>
  readonly validate: Atom.AtomResultFn<void, void, never>
  readonly reset: Atom.Writable<void, void>
  readonly revertToLastSubmit: Atom.Writable<void, void>
  readonly setValues: Atom.Writable<Field.EncodedFromFields<TFields>>
  readonly getFieldAtoms: <S,>(field: FormBuilder.FieldRef<S>) => FormAtoms.PublicFieldAtoms<S>

  readonly mount: Atom.Atom<void>
  readonly KeepAlive: React.FC
} & FieldComponents<TFields, CM>

type FieldComponents<TFields extends Field.FieldsRecord, CM extends FieldComponentMap<TFields>,> = {
  readonly [K in keyof TFields]: TFields[K] extends Field.FieldDef<any, any> ? React.FC<ExtractExtraProps<CM[K]>>
    : TFields[K] extends Field.ArrayFieldDef<any, infer S>
      ? ArrayFieldComponent<S, ExtractArrayItemExtraProps<CM[K], S>>
    : never
}

type ExtractArrayItemExtraProps<CM, S extends Schema.Top,> = StructFieldsFromSchema<S> extends Schema.Struct.Fields ? {
    readonly [K in keyof StructFieldsFromSchema<S>]: CM extends { readonly [P in K]: infer C } ? ExtractExtraProps<C>
      : never
  }
  : CM extends React.FC<FieldComponentProps<any, infer P>> ? P
  : never

type ArrayFieldComponent<S extends Schema.Top, ExtraPropsMap,> =
  & React.FC<{
    readonly children: (ops: ArrayFieldOperations<Schema.Codec.Encoded<S>>) => React.ReactNode
  }>
  & {
    readonly Item: React.FC<{
      readonly index: number
      readonly children: React.ReactNode | ((props: { readonly remove: () => void }) => React.ReactNode)
    }>
  }
  & (StructFieldsFromSchema<S> extends Schema.Struct.Fields ? {
      readonly [K in keyof StructFieldsFromSchema<S>]: React.FC<
        ExtraPropsMap extends { readonly [P in K]: infer EP } ? EP : Record<string, never>
      >
    }
    : unknown)

interface ArrayItemContextValue {
  readonly index: number
  readonly parentPath: string
}

const ArrayItemContext = createContext<ArrayItemContextValue | null>(null)

const makeFieldComponent = <S extends Schema.Top, P,>(
  fieldKey: string,
  fieldDef: Field.FieldDef<string, S>,
  getOrCreateFieldAtoms: (fieldPath: string, schema: Schema.Top) => FormAtoms.FieldAtoms,
  Component: React.FC<FieldComponentProps<Schema.Codec.Encoded<S>, P>>,
  onBlurSubmitAtom: Atom.Writable<void, void>
): React.FC<P> => {
  const FieldComponent: React.FC<P> = (extraProps) => {
    const arrayCtx = useContext(ArrayItemContext)
    const fieldPath = arrayCtx ? `${arrayCtx.parentPath}.${fieldKey}` : fieldKey

    const fieldAtoms = React.useMemo(
      () => getOrCreateFieldAtoms(fieldPath, fieldDef.schema),
      [fieldPath]
    )

    const [value, setValue] = useAtom(fieldAtoms.valueAtom) as [Schema.Codec.Encoded<S>, (v: unknown) => void]
    const [isTouched, setTouched] = useAtom(fieldAtoms.touchedAtom)
    const displayError = useAtomValue(fieldAtoms.displayErrorAtom)
    const isDirty = useAtomValue(fieldAtoms.isDirtyAtom)
    const isValidating = useAtomValue(fieldAtoms.validationAtom).waiting
    const setOnBlurSubmit = useAtomSet(onBlurSubmitAtom)

    useAtomMount(fieldAtoms.triggerValidationAtom)

    const onChange = React.useCallback(
      (newValue: Schema.Codec.Encoded<S>) => setValue(newValue),
      [setValue]
    )

    const onBlur = React.useCallback(() => {
      setTouched(true)
      setOnBlurSubmit()
    }, [setTouched, setOnBlurSubmit])

    const fieldState = React.useMemo(
      () => ({
        path: fieldPath,
        value,
        onChange,
        onBlur,
        error: displayError,
        isTouched,
        isValidating,
        isDirty
      }),
      [fieldPath, value, onChange, onBlur, displayError, isTouched, isValidating, isDirty]
    )

    return <Component field={fieldState} props={extraProps} />
  }
  return React.memo(FieldComponent) as React.FC<P>
}

const makeArrayFieldComponent = <S extends Schema.Top,>(
  fieldKey: string,
  def: Field.ArrayFieldDef<string, S>,
  stateAtom: Atom.Writable<Option.Option<FormBuilder.FormState<any>>, Option.Option<FormBuilder.FormState<any>>>,
  getOrCreateFieldAtoms: (fieldPath: string, schema: Schema.Top) => FormAtoms.FieldAtoms,
  operations: FormAtoms.FormOperations<any>,
  componentMap: ArrayItemComponentMap<S>,
  onBlurSubmitAtom: Atom.Writable<void, void>
): ArrayFieldComponent<S, any> => {
  const ArrayWrapper: React.FC<{
    readonly children: (ops: ArrayFieldOperations<Schema.Codec.Encoded<S>>) => React.ReactNode
  }> = ({ children }) => {
    const arrayCtx = useContext(ArrayItemContext)
    const [formStateOption, setFormState] = useAtom(stateAtom)

    const fieldPath = arrayCtx ? `${arrayCtx.parentPath}.${fieldKey}` : fieldKey
    if (Option.isNone(formStateOption)) {
      throw new Error(
        `Array field "${fieldPath}" was rendered before the form was initialized. ` +
          "Form state does not exist until initialization: render array field components inside " +
          "<form.Initialize defaultValues={...}>. " +
          `See the "Basic Form Setup" section of the README.`
      )
    }
    const formState = formStateOption.value
    const items = React.useMemo(
      () => (getNestedValue(formState.values, fieldPath) ?? []) as ReadonlyArray<Schema.Codec.Encoded<S>>,
      [formState.values, fieldPath]
    )

    const append = React.useCallback(
      (value?: Schema.Codec.Encoded<S>) => {
        setFormState((prev) => {
          if (Option.isNone(prev)) return prev
          return Option.some(operations.appendArrayItem(prev.value, fieldPath, def.itemSchema, value))
        })
      },
      [fieldPath, setFormState]
    )

    const remove = React.useCallback(
      (index: number) => {
        setFormState((prev) => {
          if (Option.isNone(prev)) return prev
          return Option.some(operations.removeArrayItem(prev.value, fieldPath, index))
        })
      },
      [fieldPath, setFormState]
    )

    const swap = React.useCallback(
      (indexA: number, indexB: number) => {
        setFormState((prev) => {
          if (Option.isNone(prev)) return prev
          return Option.some(operations.swapArrayItems(prev.value, fieldPath, indexA, indexB))
        })
      },
      [fieldPath, setFormState]
    )

    const move = React.useCallback(
      (from: number, to: number) => {
        setFormState((prev) => {
          if (Option.isNone(prev)) return prev
          return Option.some(operations.moveArrayItem(prev.value, fieldPath, from, to))
        })
      },
      [fieldPath, setFormState]
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

  const subFieldDefs = Field.extractStructFieldDefs(def.itemSchema)
  if (subFieldDefs) {
    for (const subDef of subFieldDefs) {
      const itemComponent = (componentMap as Record<string, React.FC<FieldComponentProps<any, any>>>)[subDef.key]
      if (itemComponent === undefined) {
        throw new Error(`Missing field component for ${subDef.key}`)
      }
      itemFieldComponents[subDef.key] = makeFieldComponent(
        subDef.key,
        subDef,
        getOrCreateFieldAtoms,
        itemComponent,
        onBlurSubmitAtom
      )
    }
  }

  const properties: Record<string, unknown> = {
    Item: ItemWrapper,
    ...itemFieldComponents
  }

  return new Proxy(ArrayWrapper, {
    get(target, prop) {
      if (prop in properties) {
        return properties[prop as string]
      }
      return Reflect.get(target, prop)
    }
  }) as ArrayFieldComponent<S, any>
}

const makeFieldComponents = <TFields extends Field.FieldsRecord, CM extends FieldComponentMap<TFields>,>(
  fields: TFields,
  stateAtom: Atom.Writable<
    Option.Option<FormBuilder.FormState<TFields>>,
    Option.Option<FormBuilder.FormState<TFields>>
  >,
  getOrCreateFieldAtoms: (fieldPath: string, schema: Schema.Top) => FormAtoms.FieldAtoms,
  operations: FormAtoms.FormOperations<TFields>,
  componentMap: CM,
  onBlurSubmitAtom: Atom.Writable<void, void>
): FieldComponents<TFields, CM> => {
  const components: Record<string, any> = {}

  for (const [key, def] of Object.entries(fields)) {
    if (Field.isArrayFieldDef(def)) {
      const arrayComponentMap = (componentMap as Record<string, any>)[key]
      components[key] = makeArrayFieldComponent(
        key,
        def as Field.ArrayFieldDef<string, Schema.Top>,
        stateAtom,
        getOrCreateFieldAtoms,
        operations,
        arrayComponentMap,
        onBlurSubmitAtom
      )
    } else if (Field.isFieldDef(def)) {
      const fieldComponent = (componentMap as Record<string, React.FC<FieldComponentProps<any, any>>>)[key]
      if (fieldComponent === undefined) {
        throw new Error(`Missing field component for ${key}`)
      }
      components[key] = makeFieldComponent(
        key,
        def,
        getOrCreateFieldAtoms,
        fieldComponent,
        onBlurSubmitAtom
      )
    }
  }

  return components as FieldComponents<TFields, CM>
}

export const make: {
  <
    TFields extends Field.FieldsRecord,
    R extends AtomRegistry.AtomRegistry,
    A,
    E,
    SubmitArgs = void,
    CM extends FieldComponentMap<TFields> = FieldComponentMap<TFields>,
  >(
    self: FormBuilder.FormBuilder<TFields, R>,
    options: {
      readonly runtime?: Atom.AtomRuntime<any, any>
      readonly fields: CM
      readonly mode?: SubmitArgs extends void ? Mode.FormMode : Mode.FormModeWithoutAutoSubmit
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
  ): BuiltForm<TFields, R, A, E, SubmitArgs, CM>

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
  ): BuiltForm<TFields, R, A, E, SubmitArgs, CM>
} = (self: any, options: any): any => {
  const { fields: components, mode, onSubmit, runtime: providedRuntime, reactivityKeys } = options
  const runtime = providedRuntime ?? Atom.runtime(Layer.empty)
  const { fields } = self

  const formAtoms = FormAtoms.make({
    formBuilder: self,
    runtime,
    onSubmit,
    reactivityKeys,
    mode
  })

  const {
    autoSubmitAtom,
    combinedSchema,
    fieldRefs,
    getFieldAtoms,
    getOrCreateFieldAtoms,
    hasChangedSinceSubmitAtom,
    isDirtyAtom,
    keepAliveActiveAtom,
    lastSubmittedValuesAtom,
    mountAtom,
    onBlurSubmitAtom,
    operations,
    resetAtom,
    revertToLastSubmitAtom,
    rootErrorAtom,
    setValuesAtom,
    stateAtom,
    submitAtom,
    submitCountAtom,
    validateAtom,
    validationCountAtom,
    valuesAtom
  } = formAtoms

  const InitializeComponent: React.FC<{
    readonly defaultValues: any
    readonly validateOnInit?: boolean
    readonly children: React.ReactNode
  }> = ({ children, defaultValues, validateOnInit }) => {
    const registry = React.useContext(RegistryContext)
    const state = useAtomValue(stateAtom)
    const setFormState = useAtomSet(stateAtom)
    const triggerValidate = useAtomSet(validateAtom)
    const [isInitialized, setIsInitialized] = React.useState(false)

    React.useEffect(() => {
      const shouldInit = !registry.get(keepAliveActiveAtom) || Option.isNone(registry.get(stateAtom))
      if (shouldInit) {
        setFormState(Option.some(operations.createInitialState(defaultValues)))
        if (validateOnInit) {
          triggerValidate()
        }
      }
      setIsInitialized(true)
    }, [registry])

    useAtomMount(autoSubmitAtom)

    if (!isInitialized) return null
    if (Option.isNone(state)) return null

    return <>{children}</>
  }

  const fieldComponents = makeFieldComponents(
    fields,
    stateAtom,
    getOrCreateFieldAtoms,
    operations,
    components,
    onBlurSubmitAtom
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
    validationCount: validationCountAtom,
    rootError: rootErrorAtom,
    schema: combinedSchema,
    fields: fieldRefs,
    Initialize: InitializeComponent,
    submit: submitAtom,
    validate: validateAtom,
    reset: resetAtom,
    revertToLastSubmit: revertToLastSubmitAtom,
    setValues: setValuesAtom,
    getFieldAtoms,
    mount: mountAtom,
    KeepAlive,
    ...fieldComponents
  }
}
