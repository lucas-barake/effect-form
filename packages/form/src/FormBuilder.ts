import type * as Registry from "@effect-atom/atom/Registry"
import type * as Effect from "effect/Effect"
import type * as Option from "effect/Option"
import * as Predicate from "effect/Predicate"
import * as Schema from "effect/Schema"

import type {
  AnyFieldDef,
  ArrayFieldDef,
  DecodedFromFields,
  EncodedFromFields,
  FieldDef,
  FieldsRecord,
} from "./Field.js"
import { isArrayFieldDef, isFieldDef } from "./Field.js"

/**
 * @category Models
 */
export interface SubmittedValues<TFields extends FieldsRecord> {
  readonly encoded: EncodedFromFields<TFields>
  readonly decoded: DecodedFromFields<TFields>
}

/**
 * Unique identifier for Field references.
 *
 * @category Symbols
 * @internal
 */
export const FieldTypeId: unique symbol = Symbol.for("@lucas-barake/effect-form/Field")

/**
 * @category Symbols
 * @internal
 */
export type FieldTypeId = typeof FieldTypeId

/**
 * A field reference carrying type and path info for type-safe setValue operations.
 *
 * @category Models
 */
export interface FieldRef<S> {
  readonly [FieldTypeId]: FieldTypeId
  readonly _S: S
  readonly key: string
}

/**
 * Creates a field reference for type-safe setValue operations.
 *
 * @category Constructors
 * @internal
 */
export const makeFieldRef = <S>(key: string): FieldRef<S> => ({
  [FieldTypeId]: FieldTypeId,
  _S: undefined as any,
  key,
})

// ================================
// FormBuilder
// ================================

/**
 * Unique identifier for FormBuilder instances.
 *
 * @category Symbols
 */
export const TypeId: unique symbol = Symbol.for("@lucas-barake/effect-form/Form")

/**
 * @category Symbols
 */
export type TypeId = typeof TypeId

/**
 * The state of a form at runtime.
 *
 * @category Models
 */
export interface FormState<TFields extends FieldsRecord> {
  readonly values: EncodedFromFields<TFields>
  readonly initialValues: EncodedFromFields<TFields>
  readonly lastSubmittedValues: Option.Option<SubmittedValues<TFields>>
  readonly touched: { readonly [K in keyof TFields]: boolean }
  readonly submitCount: number
  readonly dirtyFields: ReadonlySet<string>
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

/**
 * A builder for constructing type-safe forms with Effect Schema validation.
 *
 * **Details**
 *
 * FormBuilder uses a fluent API pattern to define form fields. Each field
 * includes a Schema for validation. The builder accumulates field definitions
 * and context requirements (`R`) from schemas that use Effect services.
 *
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
   * const NameField = Field.makeField("name", Schema.String)
   * const form = FormBuilder.empty.addField(NameField)
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
   * const ItemsField = Field.makeArrayField("items", Schema.Struct({ name: Schema.String }))
   * const form = FormBuilder.empty.addField(ItemsField)
   * ```
   */
  addField<K extends string, S extends Schema.Schema.Any>(
    this: FormBuilder<TFields, R>,
    field: ArrayFieldDef<K, S>,
  ): FormBuilder<TFields & { readonly [key in K]: ArrayFieldDef<K, S> }, R | Schema.Schema.Context<S>>

  /**
   * Merges another FormBuilder's fields into this one.
   * Useful for composing reusable field groups.
   *
   * @example
   * ```ts
   * const addressFields = FormBuilder.empty
   *   .addField("street", Schema.String)
   *   .addField("city", Schema.String)
   *
   * const userForm = FormBuilder.empty
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
   * const form = FormBuilder.empty
   *   .addField("password", Schema.String)
   *   .addField("confirmPassword", Schema.String)
   *   .refine((values) => {
   *     if (values.password !== values.confirmPassword) {
   *       return { path: ["confirmPassword"], message: "Passwords must match" }
   *     }
   *   })
   * ```
   */
  refine(
    this: FormBuilder<TFields, R>,
    predicate: (values: DecodedFromFields<TFields>) => Schema.FilterOutput,
  ): FormBuilder<TFields, R>

  /**
   * Adds an asynchronous cross-field validation refinement to the form.
   *
   * @example
   * ```ts
   * const form = FormBuilder.empty
   *   .addField("username", Schema.String)
   *   .refineEffect((values) =>
   *     Effect.gen(function* () {
   *       const taken = yield* checkUsername(values.username)
   *       if (taken) return { path: ["username"], message: "Already taken" }
   *     })
   *   )
   * ```
   */
  refineEffect<RD>(
    this: FormBuilder<TFields, R>,
    predicate: (values: DecodedFromFields<TFields>) => Effect.Effect<Schema.FilterOutput, never, RD>,
  ): FormBuilder<TFields, R | Exclude<RD, Registry.AtomRegistry>>
}

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
    predicate: (values: DecodedFromFields<TFields>) => Schema.FilterOutput,
  ): FormBuilder<TFields, R> {
    const newSelf = Object.create(FormBuilderProto)
    newSelf.fields = this.fields
    newSelf.refinements = [
      ...this.refinements,
      { _tag: "sync" as const, fn: (values: unknown) => predicate(values as DecodedFromFields<TFields>) },
    ]
    return newSelf
  },
  refineEffect<TFields extends FieldsRecord, R, RD>(
    this: FormBuilder<TFields, R>,
    predicate: (values: DecodedFromFields<TFields>) => Effect.Effect<Schema.FilterOutput, never, RD>,
  ): FormBuilder<TFields, R | Exclude<RD, Registry.AtomRegistry>> {
    const newSelf = Object.create(FormBuilderProto)
    newSelf.fields = this.fields
    newSelf.refinements = [
      ...this.refinements,
      { _tag: "async" as const, fn: (values: unknown) => predicate(values as DecodedFromFields<TFields>) },
    ]
    return newSelf
  },
}

/**
 * Checks if a value is a `FormBuilder`.
 *
 * @example
 * ```ts
 * import { FormBuilder } from "@lucas-barake/effect-form"
 *
 * const builder = FormBuilder.empty
 *
 * console.log(FormBuilder.isFormBuilder(builder))
 * // Output: true
 *
 * console.log(FormBuilder.isFormBuilder({}))
 * // Output: false
 * ```
 *
 * @category Guards
 */
export const isFormBuilder = (u: unknown): u is FormBuilder<any, any> => Predicate.hasProperty(u, TypeId)

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
 * import { Field, FormBuilder } from "@lucas-barake/effect-form"
 * import * as Schema from "effect/Schema"
 *
 * const EmailField = Field.makeField("email", Schema.String)
 * const PasswordField = Field.makeField("password", Schema.String)
 *
 * const loginForm = FormBuilder.empty
 *   .addField(EmailField)
 *   .addField(PasswordField)
 * ```
 *
 * @category Constructors
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export const empty: FormBuilder<{}, never> = (() => {
  const self = Object.create(FormBuilderProto)
  self.fields = {}
  self.refinements = []
  return self
})()

/**
 * Builds a combined Schema from a FormBuilder's field definitions.
 *
 * @category Schema
 */
export const buildSchema = <TFields extends FieldsRecord, R>(
  self: FormBuilder<TFields, R>,
): Schema.Schema<DecodedFromFields<TFields>, EncodedFromFields<TFields>, R> => {
  const schemaFields: Record<string, Schema.Schema.Any> = {}
  for (const [key, def] of Object.entries(self.fields)) {
    if (isArrayFieldDef(def)) {
      schemaFields[key] = Schema.Array(def.itemSchema)
    } else if (isFieldDef(def)) {
      schemaFields[key] = def.schema
    }
  }

  let schema: Schema.Schema<any, any, any> = Schema.Struct(schemaFields)

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
