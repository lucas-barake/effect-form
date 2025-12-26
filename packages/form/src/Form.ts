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

// ================================
// Field Definition Types
// ================================

/**
 * A field definition containing only the schema.
 *
 * @since 1.0.0
 * @category Models
 */
export interface FieldDef<S extends Schema.Schema.Any> {
  readonly _tag: "field"
  readonly schema: S
}

/**
 * An array field definition containing a nested FormBuilder for items.
 *
 * @since 1.0.0
 * @category Models
 */
export interface ArrayFieldDef<TItemForm extends FormBuilder<any, any>> {
  readonly _tag: "array"
  readonly itemForm: TItemForm
}

/**
 * Union of all field definition types.
 *
 * @since 1.0.0
 * @category Models
 */
export type AnyFieldDef = FieldDef<Schema.Schema.Any> | ArrayFieldDef<any>

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
  readonly [K in keyof T]: T[K] extends FieldDef<infer S> ? Schema.Schema.Encoded<S>
    : T[K] extends ArrayFieldDef<infer F> ? ReadonlyArray<EncodedFromFields<F["fields"]>>
    : never
}

/**
 * Extracts the decoded (output) type from a fields record.
 *
 * @since 1.0.0
 * @category Type Helpers
 */
export type DecodedFromFields<T extends FieldsRecord> = {
  readonly [K in keyof T]: T[K] extends FieldDef<infer S> ? Schema.Schema.Type<S>
    : T[K] extends ArrayFieldDef<infer F> ? ReadonlyArray<DecodedFromFields<F["fields"]>>
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
   * Adds a field to the form builder.
   *
   * @example
   * ```ts
   * const form = Form.empty
   *   .addField("email", Schema.String)
   *   .addField("password", Schema.String)
   * ```
   */
  addField<K extends string, S extends Schema.Schema.Any>(
    this: FormBuilder<TFields, R>,
    name: K,
    schema: S,
  ): FormBuilder<TFields & { readonly [key in K]: FieldDef<S> }, R | Schema.Schema.Context<S>>

  /**
   * Adds an array field to the form for managing lists of items.
   *
   * @example
   * ```ts
   * const itemForm = Form.empty.addField("name", Schema.String)
   *
   * const form = Form.empty
   *   .addField("title", Schema.String)
   *   .addArray("items", itemForm)
   * ```
   */
  addArray<K extends string, TItemFields extends FieldsRecord, IR>(
    this: FormBuilder<TFields, R>,
    name: K,
    itemForm: FormBuilder<TItemFields, IR>,
  ): FormBuilder<TFields & { readonly [key in K]: ArrayFieldDef<FormBuilder<TItemFields, IR>> }, R | IR>

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
  addField<TFields extends FieldsRecord, R, K extends string, S extends Schema.Schema.Any>(
    this: FormBuilder<TFields, R>,
    name: K,
    schema: S,
  ): FormBuilder<TFields & { readonly [key in K]: FieldDef<S> }, R | Schema.Schema.Context<S>> {
    const newSelf = Object.create(FormBuilderProto)
    newSelf.fields = { ...this.fields, [name]: { _tag: "field" as const, schema } }
    newSelf.refinements = this.refinements
    return newSelf
  },
  addArray<TFields extends FieldsRecord, R, K extends string, TItemFields extends FieldsRecord, IR>(
    this: FormBuilder<TFields, R>,
    name: K,
    itemForm: FormBuilder<TItemFields, IR>,
  ): FormBuilder<TFields & { readonly [key in K]: ArrayFieldDef<FormBuilder<TItemFields, IR>> }, R | IR> {
    const newSelf = Object.create(FormBuilderProto)
    newSelf.fields = { ...this.fields, [name]: { _tag: "array" as const, itemForm } }
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
export const isArrayFieldDef = (def: AnyFieldDef): def is ArrayFieldDef<any> => def._tag === "array"

/**
 * Checks if a field definition is a simple field.
 *
 * @since 1.0.0
 * @category Guards
 */
export const isFieldDef = (def: AnyFieldDef): def is FieldDef<Schema.Schema.Any> => def._tag === "field"

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
 * const loginForm = Form.empty
 *   .addField("email", Schema.String)
 *   .addField("password", Schema.String)
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

  // Apply refinements in order
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
