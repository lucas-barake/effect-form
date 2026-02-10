import { RegistryContext, useAtom, useAtomMount, useAtomSet, useAtomValue } from "@effectify/solid-effect-atom"
import * as Atom from "@effect-atom/atom/Atom"
import type * as Registry from "@effect-atom/atom/Registry"
import { Field, FormAtoms } from "@lucas-barake/effect-form"
import type { FieldState as FieldStateModule, Mode } from "@lucas-barake/effect-form"
import type * as FormBuilder from "@lucas-barake/effect-form/FormBuilder"
import { getNestedValue } from "@lucas-barake/effect-form/Path"
import type * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import type * as ParseResult from "effect/ParseResult"
import type * as Schema from "effect/Schema"
import { createContext, useContext, createMemo, createEffect, createSignal, onCleanup, onMount, Show } from "solid-js"
import type { Component, JSX, Accessor } from "solid-js"

export type FieldValue<T,> = FieldStateModule.FieldValue<T>

export type FieldState<E,> = FieldStateModule.FieldState<E>

export interface ArrayFieldOperations<TItem> {
  readonly items: () => ReadonlyArray<TItem>
  readonly append: (value?: TItem) => void
  readonly remove: (index: number) => void
  readonly swap: (indexA: number, indexB: number) => void
  readonly move: (from: number, to: number) => void
}

export interface FieldComponentProps<E, P = Record<string, never>,> {
  readonly field: FieldState<E>
  readonly props: P
}

export type FieldComponent<T, P = Record<string, never>,> = Component<FieldComponentProps<FieldValue<T>, P>>

export type ExtractExtraProps<C,> = C extends Component<FieldComponentProps<any, infer P>> ? P : Record<string, never>

type StructFieldsFromSchema<S,> = S extends Schema.Struct<infer Fields> ? Fields
  : S extends { readonly from: infer From } ? StructFieldsFromSchema<From>
  : never

export type ArrayItemComponentMap<S extends Schema.Schema.Any,> = StructFieldsFromSchema<S> extends
  Schema.Struct.Fields ? {
    readonly [K in keyof StructFieldsFromSchema<S>]: StructFieldsFromSchema<S>[K] extends Schema.Schema.Any
      ? Component<FieldComponentProps<Schema.Schema.Encoded<StructFieldsFromSchema<S>[K]>, any>>
      : never
  }
  : Component<FieldComponentProps<Schema.Schema.Encoded<S>, any>>

export type FieldComponentMap<TFields extends Field.FieldsRecord,> = {
  readonly [K in keyof TFields]: TFields[K] extends Field.FieldDef<any, infer S>
    ? Component<FieldComponentProps<Schema.Schema.Encoded<S>, any>>
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

  readonly schema: Schema.Schema<Field.DecodedFromFields<TFields>, Field.EncodedFromFields<TFields>, R>
  readonly fields: FieldRefs<TFields>

  readonly Initialize: Component<{
    readonly defaultValues: Field.EncodedFromFields<TFields>
    readonly children: JSX.Element
  }>

  readonly submit: Atom.AtomResultFn<SubmitArgs, A, E | ParseResult.ParseError>
  readonly reset: Atom.Writable<void, void>
  readonly revertToLastSubmit: Atom.Writable<void, void>
  readonly setValues: Atom.Writable<Field.EncodedFromFields<TFields>>
  readonly getFieldAtoms: <S,>(field: FormBuilder.FieldRef<S>) => FormAtoms.PublicFieldAtoms<S>

  readonly mount: Atom.Atom<void>
  readonly KeepAlive: Component
} & FieldComponents<TFields, CM>

type FieldComponents<TFields extends Field.FieldsRecord, CM extends FieldComponentMap<TFields>,> = {
  readonly [K in keyof TFields]: TFields[K] extends Field.FieldDef<any, any> ? Component<ExtractExtraProps<CM[K]>>
    : TFields[K] extends Field.ArrayFieldDef<any, infer S>
      ? ArrayFieldComponent<S, ExtractArrayItemExtraProps<CM[K], S>>
    : never
}

type ExtractArrayItemExtraProps<CM, S extends Schema.Schema.Any,> = StructFieldsFromSchema<S> extends
  Schema.Struct.Fields ? {
    readonly [K in keyof StructFieldsFromSchema<S>]: CM extends { readonly [P in K]: infer C } ? ExtractExtraProps<C>
      : never
  }
  : CM extends Component<FieldComponentProps<any, infer P>> ? P
  : never

type ArrayFieldComponent<S extends Schema.Schema.Any, ExtraPropsMap,> =
  & Component<{
    readonly children: (ops: ArrayFieldOperations<Schema.Schema.Encoded<S>>) => JSX.Element
  }>
  & {
    readonly Item: Component<{
      readonly index: number
      readonly children: JSX.Element | ((props: { readonly remove: () => void }) => JSX.Element)
    }>
  }
  & (StructFieldsFromSchema<S> extends Schema.Struct.Fields ? {
      readonly [K in keyof StructFieldsFromSchema<S>]: Component<
        ExtraPropsMap extends { readonly [P in K]: infer EP } ? (EP extends Record<string, any> ? EP : Record<string, any>) : Record<string, any>
      >
    }
    : unknown)

interface ArrayItemContextValue {
  readonly index: Accessor<number>
  readonly parentPath: Accessor<string>
}

const ArrayItemContext = createContext<ArrayItemContextValue | null>(null)

const makeFieldComponent = <S extends Schema.Schema.Any, P extends Record<string, any>>(
  fieldKey: string,
  fieldDef: Field.FieldDef<string, S>,
  getOrCreateFieldAtoms: (fieldPath: string, schema: Schema.Schema.Any) => FormAtoms.FieldAtoms,
  Component: Component<FieldComponentProps<Schema.Schema.Encoded<S>, P>>,
  onBlurSubmitAtom: Atom.Writable<void, void>
): Component<P> => {
  const InnerFieldComponent: Component<{ atoms: FormAtoms.FieldAtoms; props: P }> = (props) => {
    const [value, setValue] = useAtom(props.atoms.valueAtom)
    const [isTouched, setTouched] = useAtom(props.atoms.touchedAtom)
    const displayError = useAtomValue(props.atoms.displayErrorAtom)
    const isDirty = useAtomValue(props.atoms.isDirtyAtom)
    const validation = useAtomValue(props.atoms.validationAtom)
    const setOnBlurSubmit = useAtomSet(onBlurSubmitAtom)

    useAtomMount(props.atoms.triggerValidationAtom)

    const onChange = (newValue: Schema.Schema.Encoded<S>) => setValue(newValue)

    const onBlur = () => {
      setTouched(true)
      setOnBlurSubmit()
    }

    const fieldState = {
      get value() { return value() },
      onChange,
      onBlur,
      get error() { return displayError() },
      get isTouched() { return isTouched() },
      get isValidating() { return (validation() as any).waiting },
      get isDirty() { return isDirty() }
    }

    return <Component field={fieldState as any} props={props.props} />
  }

  const FieldComponent: Component<P> = (extraProps) => {
    const arrayCtx = useContext(ArrayItemContext)
    const fieldPath = createMemo(() => arrayCtx ? `${arrayCtx.parentPath()}.${fieldKey}` : fieldKey)

    const fieldAtoms = createMemo(() => getOrCreateFieldAtoms(fieldPath(), fieldDef.schema))

    return (
      <Show when={fieldAtoms()} keyed>
        {(atoms) => <InnerFieldComponent atoms={atoms} props={extraProps} />}
      </Show>
    )
  }
  return FieldComponent
}

const makeArrayFieldComponent = <S extends Schema.Schema.Any,>(
  fieldKey: string,
  def: Field.ArrayFieldDef<string, S>,
  stateAtom: Atom.Writable<Option.Option<FormBuilder.FormState<any>>, Option.Option<FormBuilder.FormState<any>>>,
  getOrCreateFieldAtoms: (fieldPath: string, schema: Schema.Schema.Any) => FormAtoms.FieldAtoms,
  operations: FormAtoms.FormOperations<any>,
  componentMap: ArrayItemComponentMap<S>,
  onBlurSubmitAtom: Atom.Writable<void, void>
): ArrayFieldComponent<S, any> => {
  const ArrayWrapper: Component<{
    readonly children: (ops: ArrayFieldOperations<Schema.Schema.Encoded<S>>) => JSX.Element
  }> = (props) => {
    const arrayCtx = useContext(ArrayItemContext)
    const [formStateOption, setFormState] = useAtom(stateAtom)

    const fieldPath = createMemo(() => arrayCtx ? `${arrayCtx.parentPath()}.${fieldKey}` : fieldKey)
    
    const items = createMemo(() => {
      const state = formStateOption()
      if (Option.isNone(state)) return []
      return (getNestedValue(state.value.values, fieldPath()) ?? []) as ReadonlyArray<Schema.Schema.Encoded<S>>
    })

    const append = (value?: Schema.Schema.Encoded<S>) => {
      setFormState((prev) => {
        if (Option.isNone(prev)) return prev
        return Option.some(operations.appendArrayItem(prev.value, fieldPath(), def.itemSchema, value))
      })
    }

    const remove = (index: number) => {
      setFormState((prev) => {
        if (Option.isNone(prev)) return prev
        return Option.some(operations.removeArrayItem(prev.value, fieldPath(), index))
      })
    }

    const swap = (indexA: number, indexB: number) => {
      setFormState((prev) => {
        if (Option.isNone(prev)) return prev
        return Option.some(operations.swapArrayItems(prev.value, fieldPath(), indexA, indexB))
      })
    }

    const move = (from: number, to: number) => {
      setFormState((prev) => {
        if (Option.isNone(prev)) return prev
        return Option.some(operations.moveArrayItem(prev.value, fieldPath(), from, to))
      })
    }

    return <>{props.children({ items, append, remove, swap, move })}</>
  }

  const ItemWrapper: Component<{
    readonly index: number
    readonly children: JSX.Element | ((props: { readonly remove: () => void }) => JSX.Element)
  }> = (props) => {
    const arrayCtx = useContext(ArrayItemContext)
    const setFormState = useAtomSet(stateAtom)

    const parentPath = createMemo(() => arrayCtx ? `${arrayCtx.parentPath()}.${fieldKey}` : fieldKey)
    const itemPath = createMemo(() => `${parentPath()}[${props.index}]`)

    const remove = () => {
      setFormState((prev) => {
        if (Option.isNone(prev)) return prev
        return Option.some(operations.removeArrayItem(prev.value, parentPath(), props.index))
      })
    }

    const contextValue: ArrayItemContextValue = {
      index: () => props.index,
      parentPath: itemPath
    }

    return (
      <ArrayItemContext.Provider value={contextValue}>
        {typeof props.children === "function" ? props.children({ remove }) : props.children}
      </ArrayItemContext.Provider>
    )
  }

  const itemFieldComponents: Record<string, Component> = {}

  const subFieldDefs = Field.extractStructFieldDefs(def.itemSchema)
  if (subFieldDefs) {
    for (const subDef of subFieldDefs) {
      const itemComponent = (componentMap as Record<string, Component<FieldComponentProps<any, any>>>)[subDef.key]
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
  getOrCreateFieldAtoms: (fieldPath: string, schema: Schema.Schema.Any) => FormAtoms.FieldAtoms,
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
        def as Field.ArrayFieldDef<string, Schema.Schema.Any>,
        stateAtom,
        getOrCreateFieldAtoms,
        operations,
        arrayComponentMap,
        onBlurSubmitAtom
      )
    } else if (Field.isFieldDef(def)) {
      const fieldComponent = (componentMap as Record<string, Component<FieldComponentProps<any, any>>>)[key]
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
    R extends Registry.AtomRegistry,
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
    valuesAtom
  } = formAtoms

  const InitializeComponent: Component<{
    readonly defaultValues: any
    readonly children: JSX.Element
  }> = (props) => {
    const registry = useContext(RegistryContext)
    const state = useAtomValue(stateAtom)
    const setFormState = useAtomSet(stateAtom)
    const [isInitialized, setIsInitialized] = createSignal(false)

    createEffect(() => {
      const isKeptAlive = registry.get(keepAliveActiveAtom)
      if (!isKeptAlive || Option.isNone(registry.get(stateAtom))) {
        setFormState(Option.some(operations.createInitialState(props.defaultValues)))
      }
      setIsInitialized(true)
    })

    const shouldRender = createMemo(() => isInitialized() && Option.isSome(state()))

    return (
      <>
        <Show when={shouldRender()}>
           <AutoSubmitHandler atom={autoSubmitAtom} />
           {props.children}
        </Show>
      </>
    )
  }

  const AutoSubmitHandler: Component<{ atom: Atom.Atom<any> }> = (props) => {
      useAtomMount(props.atom)
      return null
  }

  const fieldComponents = makeFieldComponents(
    self.fields,
    stateAtom,
    getOrCreateFieldAtoms,
    operations,
    components,
    onBlurSubmitAtom
  )

  const KeepAlive: Component = () => {
    const setKeepAliveActive = useAtomSet(keepAliveActiveAtom)

    onMount(() => {
      setKeepAliveActive(true)
    })
    
    onCleanup(() => {
      setKeepAliveActive(false)
    })

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
    getFieldAtoms,
    mount: mountAtom,
    KeepAlive,
    ...fieldComponents
  }
}
