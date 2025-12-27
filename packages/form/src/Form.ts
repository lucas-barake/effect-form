/**
 * @since 1.0.0
 */
import type * as Effect from "effect/Effect"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"

// ================================
// TypeId
// ================================

/**
 * Unique identifier for FormBuilder instances.
 *
 * @since 1.0.0
 * @category Symbols
 */
export const TypeId: unique symbol = Symbol.for("@lucas-barake/effect-form/Form")

/**
 * @since 1.0.0
 * @category Symbols
 */
export type TypeId = typeof TypeId

/**
 * Unique identifier for Field references.
 *
 * @since 1.0.0
 * @category Symbols
 * @internal
 */
export const FieldTypeId: unique symbol = Symbol.for("@lucas-barake/effect-form/Field")

/**
 * @since 1.0.0
 * @category Symbols
 * @internal
 */
export type FieldTypeId = typeof FieldTypeId

/**
 * A field reference carrying type and path info for type-safe setValue operations.
 *
 * @since 1.0.0
 * @category Models
 */
export interface Field<S> {
  readonly [FieldTypeId]: FieldTypeId
  readonly _S: S
  readonly key: string
}

/**
 * Creates a field reference for type-safe setValue operations.
 *
 * @since 1.0.0
 * @category Constructors
 * @internal
 */
export const makeFieldRef = <S>(key: string): Field<S> => ({
  [FieldTypeId]: FieldTypeId,
  _S: undefined as any,
  key,
})

// ================================
// Field Definition Types
// ================================

/**
 * A scalar field definition containing the key and schema.
 *
 * @since 1.0.0
 * @category Models
 */
export interface FieldDef<K extends string, S extends Schema.Schema.Any> {
  readonly _tag: "field"
  readonly key: K
  readonly schema: S
}

/**
 * An array field definition containing a nested FormBuilder for items.
 *
 * @since 1.0.0
 * @category Models
 */
export interface ArrayFieldDef<K extends string, TItemForm extends FormBuilder<any, any>> {
  readonly _tag: "array"
  readonly key: K
  readonly itemForm: TItemForm
}

/**
 * Union of all field definition types.
 *
 * @since 1.0.0
 * @category Models
 */
export type AnyFieldDef = FieldDef<string, Schema.Schema.Any> | ArrayFieldDef<string, any>

/**
 * Creates a scalar field definition.
 *
 * @example
 * ```ts
 * const NameField = Form.makeField("name", Schema.String)
 * const form = Form.empty.addField(NameField)
 * ```
 *
 * @since 1.0.0
 * @category Constructors
 */
export const makeField = <K extends string, S extends Schema.Schema.Any>(
  key: K,
  schema: S,
): FieldDef<K, S> => ({
  _tag: "field",
  key,
  schema,
})

/**
 * Creates an array field definition.
 *
 * @example
 * ```ts
 * const itemForm = Form.empty.addField(Form.makeField("name", Schema.String))
 * const ItemsField = Form.makeArrayField("items", itemForm)
 * const form = Form.empty.addField(ItemsField)
 * ```
 *
 * @since 1.0.0
 * @category Constructors
 */
export const makeArrayField = <K extends string, TItemFields extends FieldsRecord, IR>(
  key: K,
  itemForm: FormBuilder<TItemFields, IR>,
): ArrayFieldDef<K, FormBuilder<TItemFields, IR>> => ({
  _tag: "array",
  key,
  itemForm,
})

/**
 * A record of field definitions.
 *
 * @since 1.0.0
 * @category Models
 */
export type FieldsRecord = Record<string, AnyFieldDef>

// ================================
// Type Extraction Helpers
// ================================

/**
 * Extracts the encoded (input) type from a fields record.
 *
 * @since 1.0.0
 * @category Type Helpers
 */
export type EncodedFromFields<T extends FieldsRecord> = {
  readonly [K in keyof T]: T[K] extends FieldDef<any, infer S> ? Schema.Schema.Encoded<S>
    : T[K] extends ArrayFieldDef<any, infer F> ? ReadonlyArray<EncodedFromFields<F["fields"]>>
    : never
}

/**
 * Extracts the decoded (output) type from a fields record.
 *
 * @since 1.0.0
 * @category Type Helpers
 */
export type DecodedFromFields<T extends FieldsRecord> = {
  readonly [K in keyof T]: T[K] extends FieldDef<any, infer S> ? Schema.Schema.Type<S>
    : T[K] extends ArrayFieldDef<any, infer F> ? ReadonlyArray<DecodedFromFields<F["fields"]>>
    : never
}

// ================================
// Form State
// ================================

/**
 * The state of a form at runtime.
 *
 * @since 1.0.0
 * @category Models
 */
export interface FormState<TFields extends FieldsRecord> {
  readonly values: EncodedFromFields<TFields>
  readonly initialValues: EncodedFromFields<TFields>
  readonly touched: { readonly [K in keyof TFields]: boolean }
  readonly submitCount: number
  readonly dirtyFields: ReadonlySet<string>
}

// ================================
// Refinement Types
// ================================

/**
 * Context passed to refinement predicates for type-safe error creation.
 *
 * @since 1.0.0
 * @category Models
 */
export interface RefineContext<TFields extends FieldsRecord> {
  /**
   * Creates a type-safe error targeting a specific field.
   *
   * @param field - The field name to attach the error to (type-safe)
   * @param message - The error message to display
   */
  readonly error: <K extends keyof TFields & string>(
    field: K,
    message: string,
  ) => Schema.FilterIssue
}

interface SyncRefinement {
  readonly _tag: "sync"
  readonly fn: (values: unknown) => Schema.FilterOutput
}

interface AsyncRefinement {
  readonly _tag: "async"
  readonly fn: (values: unknown) => Effect.Effect<Schema.FilterOutput, never, unknown>
}

type Refinement = SyncRefinement | AsyncRefinement

// ================================
// FormBuilder Interface
// ================================

/**
 * A builder for constructing type-safe forms with Effect Schema validation.
 *
 * **Details**
 *
 * FormBuilder uses a fluent API pattern to define form fields. Each field
 * includes a Schema for validation. The builder accumulates field definitions
 * and context requirements (`R`) from schemas that use Effect services.
 *
 * @since 1.0.0
 * @category Models
 */
export interface FormBuilder<TFields extends FieldsRecord, R> {
  readonly [TypeId]: TypeId
  readonly fields: TFields
  readonly refinements: ReadonlyArray<Refinement>
  readonly _R?: R

  /**
   * Adds a scalar field to the form builder.
   *
   * @example
   * ```ts
   * const NameField = Form.makeField("name", Schema.String)
   * const form = Form.empty.addField(NameField)
   * ```
   */
  addField<K extends string, S extends Schema.Schema.Any>(
    this: FormBuilder<TFields, R>,
    field: FieldDef<K, S>,
  ): FormBuilder<TFields & { readonly [key in K]: FieldDef<K, S> }, R | Schema.Schema.Context<S>>

  /**
   * Adds an array field to the form builder.
   *
   * @example
   * ```ts
   * const itemForm = Form.empty.addField(Form.makeField("name", Schema.String))
   * const ItemsField = Form.makeArrayField("items", itemForm)
   * const form = Form.empty.addField(ItemsField)
   * ```
   */
  addField<K extends string, TItemFields extends FieldsRecord, IR>(
    this: FormBuilder<TFields, R>,
    field: ArrayFieldDef<K, FormBuilder<TItemFields, IR>>,
  ): FormBuilder<TFields & { readonly [key in K]: ArrayFieldDef<K, FormBuilder<TItemFields, IR>> }, R | IR>

  /**
   * Merges another FormBuilder's fields into this one.
   * Useful for composing reusable field groups.
   *
   * @example
   * ```ts
   * const addressFields = Form.empty
   *   .addField("street", Schema.String)
   *   .addField("city", Schema.String)
   *
   * const userForm = Form.empty
   *   .addField("name", Schema.String)
   *   .merge(addressFields)
   * ```
   */
  merge<TFields2 extends FieldsRecord, R2>(
    this: FormBuilder<TFields, R>,
    other: FormBuilder<TFields2, R2>,
  ): FormBuilder<TFields & TFields2, R | R2>

  /**
   * Adds a synchronous cross-field validation refinement to the form.
   *
   * @example
   * ```ts
   * const form = Form.empty
   *   .addField("password", Schema.String)
   *   .addField("confirmPassword", Schema.String)
   *   .refine((values, ctx) => {
   *     if (values.password !== values.confirmPassword) {
   *       return ctx.error("confirmPassword", "Passwords must match")
   *     }
   *   })
   * ```
   */
  refine(
    this: FormBuilder<TFields, R>,
    predicate: (
      values: DecodedFromFields<TFields>,
      ctx: RefineContext<TFields>,
    ) => Schema.FilterOutput,
  ): FormBuilder<TFields, R>

  /**
   * Adds an asynchronous cross-field validation refinement to the form.
   *
   * @example
   * ```ts
   * const form = Form.empty
   *   .addField("username", Schema.String)
   *   .refineEffect((values, ctx) =>
   *     Effect.gen(function* () {
   *       const taken = yield* checkUsername(values.username)
   *       if (taken) return ctx.error("username", "Already taken")
   *     })
   *   )
   * ```
   */
  refineEffect<RD>(
    this: FormBuilder<TFields, R>,
    predicate: (
      values: DecodedFromFields<TFields>,
      ctx: RefineContext<TFields>,
    ) => Effect.Effect<Schema.FilterOutput, never, RD>,
  ): FormBuilder<TFields, R | RD>
}

// ================================
// FormBuilder Prototype
// ================================

const FormBuilderProto = {
  [TypeId]: TypeId,
  addField<TFields extends FieldsRecord, R>(
    this: FormBuilder<TFields, R>,
    field: AnyFieldDef,
  ): FormBuilder<any, any> {
    const newSelf = Object.create(FormBuilderProto)
    newSelf.fields = { ...this.fields, [field.key]: field }
    newSelf.refinements = this.refinements
    return newSelf
  },
  merge<TFields extends FieldsRecord, R, TFields2 extends FieldsRecord, R2>(
    this: FormBuilder<TFields, R>,
    other: FormBuilder<TFields2, R2>,
  ): FormBuilder<TFields & TFields2, R | R2> {
    const newSelf = Object.create(FormBuilderProto)
    newSelf.fields = { ...this.fields, ...other.fields }
    newSelf.refinements = [...this.refinements, ...other.refinements]
    return newSelf
  },
  refine<TFields extends FieldsRecord, R>(
    this: FormBuilder<TFields, R>,
    predicate: (
      values: DecodedFromFields<TFields>,
      ctx: RefineContext<TFields>,
    ) => Schema.FilterOutput,
  ): FormBuilder<TFields, R> {
    const ctx: RefineContext<TFields> = {
      error: (field, message) => ({ path: [field], message }),
    }
    const newSelf = Object.create(FormBuilderProto)
    newSelf.fields = this.fields
    newSelf.refinements = [
      ...this.refinements,
      { _tag: "sync" as const, fn: (values: unknown) => predicate(values as DecodedFromFields<TFields>, ctx) },
    ]
    return newSelf
  },
  refineEffect<TFields extends FieldsRecord, R, RD>(
    this: FormBuilder<TFields, R>,
    predicate: (
      values: DecodedFromFields<TFields>,
      ctx: RefineContext<TFields>,
    ) => Effect.Effect<Schema.FilterOutput, never, RD>,
  ): FormBuilder<TFields, R | RD> {
    const ctx: RefineContext<TFields> = {
      error: (field, message) => ({ path: [field], message }),
    }
    const newSelf = Object.create(FormBuilderProto)
    newSelf.fields = this.fields
    newSelf.refinements = [
      ...this.refinements,
      { _tag: "async" as const, fn: (values: unknown) => predicate(values as DecodedFromFields<TFields>, ctx) },
    ]
    return newSelf
  },
}

// ================================
// Type Guards
// ================================

/**
 * Checks if a value is a `FormBuilder`.
 *
 * @example
 * ```ts
 * import * as Form from "@lucas-barake/effect-form"
 *
 * const builder = Form.empty
 *
 * console.log(Form.isFormBuilder(builder))
 * // Output: true
 *
 * console.log(Form.isFormBuilder({}))
 * // Output: false
 * ```
 *
 * @since 1.0.0
 * @category Guards
 */
export const isFormBuilder = (u: unknown): u is FormBuilder<any, any> => Predicate.hasProperty(u, TypeId)

/**
 * Checks if a field definition is an array field.
 *
 * @since 1.0.0
 * @category Guards
 */
export const isArrayFieldDef = (def: AnyFieldDef): def is ArrayFieldDef<string, any> => def._tag === "array"

/**
 * Checks if a field definition is a simple field.
 *
 * @since 1.0.0
 * @category Guards
 */
export const isFieldDef = (def: AnyFieldDef): def is FieldDef<string, Schema.Schema.Any> => def._tag === "field"

// ================================
// Constructors
// ================================

/**
 * An empty `FormBuilder` to start building a form.
 *
 * **Details**
 *
 * This is the entry point for building a form. Use method chaining to add
 * fields and then build the form with a React adapter.
 *
 * @example
 * ```ts
 * import * as Form from "@lucas-barake/effect-form"
 * import * as Schema from "effect/Schema"
 *
 * const EmailField = Form.makeField("email", Schema.String)
 * const PasswordField = Form.makeField("password", Schema.String)
 *
 * const loginForm = Form.empty
 *   .addField(EmailField)
 *   .addField(PasswordField)
 * ```
 *
 * @since 1.0.0
 * @category Constructors
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export const empty: FormBuilder<{}, never> = (() => {
  const self = Object.create(FormBuilderProto)
  self.fields = {}
  self.refinements = []
  return self
})()

// ================================
// Schema Building
// ================================

/**
 * Builds a combined Schema from a FormBuilder's field definitions.
 *
 * @since 1.0.0
 * @category Schema
 */
export const buildSchema = <TFields extends FieldsRecord, R>(
  self: FormBuilder<TFields, R>,
): Schema.Schema<DecodedFromFields<TFields>, EncodedFromFields<TFields>, R> => {
  const buildSchemaFromFields = (fields: FieldsRecord): Schema.Schema<any, any, any> => {
    const schemaFields: Record<string, Schema.Schema.Any> = {}
    for (const [key, def] of Object.entries(fields)) {
      if (isArrayFieldDef(def)) {
        const itemSchema = buildSchemaFromFields(def.itemForm.fields)
        schemaFields[key] = Schema.Array(itemSchema)
      } else if (isFieldDef(def)) {
        schemaFields[key] = def.schema
      }
    }
    return Schema.Struct(schemaFields)
  }

  let schema: Schema.Schema<any, any, any> = buildSchemaFromFields(self.fields)

  for (const refinement of self.refinements) {
    if (refinement._tag === "sync") {
      schema = schema.pipe(Schema.filter(refinement.fn))
    } else {
      schema = schema.pipe(Schema.filterEffect(refinement.fn))
    }
  }

  return schema as Schema.Schema<
    DecodedFromFields<TFields>,
    EncodedFromFields<TFields>,
    R
  >
}

// ================================
// Helpers
// ================================

/**
 * Gets default encoded values for a fields record.
 *
 * @since 1.0.0
 * @category Helpers
 */
export const getDefaultEncodedValues = (fields: FieldsRecord): Record<string, unknown> => {
  const result: Record<string, unknown> = {}
  for (const [key, def] of Object.entries(fields)) {
    if (isArrayFieldDef(def)) {
      result[key] = []
    } else {
      result[key] = ""
    }
  }
  return result
}

/**
 * Creates a touched record with all fields set to the given value.
 *
 * @since 1.0.0
 * @category Helpers
 */
export const createTouchedRecord = (fields: FieldsRecord, value: boolean): Record<string, boolean> => {
  const result: Record<string, boolean> = {}
  for (const key of Object.keys(fields)) {
    result[key] = value
  }
  return result
}
