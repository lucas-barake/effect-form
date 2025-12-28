/**
 * Field definitions for type-safe forms.
 */
import * as Schema from "effect/Schema"

/**
 * Unique identifier for Field instances.
 *
 * @category Symbols
 */
export const TypeId: unique symbol = Symbol.for("@lucas-barake/effect-form/Field")

/**
 * @category Symbols
 */
export type TypeId = typeof TypeId

/**
 * A scalar field definition containing the key and schema.
 *
 * @category Models
 */
export interface FieldDef<K extends string, S extends Schema.Schema.Any> {
  readonly _tag: "field"
  readonly key: K
  readonly schema: S
}

/**
 * An array field definition containing a schema for items.
 *
 * @category Models
 */
export interface ArrayFieldDef<K extends string, S extends Schema.Schema.Any> {
  readonly _tag: "array"
  readonly key: K
  readonly itemSchema: S
}

/**
 * Union of all field definition types.
 *
 * @category Models
 */
export type AnyFieldDef = FieldDef<string, Schema.Schema.Any> | ArrayFieldDef<string, Schema.Schema.Any>

/**
 * A record of field definitions.
 *
 * @category Models
 */
export type FieldsRecord = Record<string, AnyFieldDef>

/**
 * Checks if a field definition is an array field.
 *
 * @category Guards
 */
export const isArrayFieldDef = (def: AnyFieldDef): def is ArrayFieldDef<string, Schema.Schema.Any> =>
  def._tag === "array"

/**
 * Checks if a field definition is a scalar field.
 *
 * @category Guards
 */
export const isFieldDef = (def: AnyFieldDef): def is FieldDef<string, Schema.Schema.Any> => def._tag === "field"

/**
 * Creates a scalar field definition.
 *
 * @example
 * ```ts
 * import * as Field from "@lucas-barake/effect-form/Field"
 * import * as Schema from "effect/Schema"
 *
 * const NameField = Field.makeField("name", Schema.String)
 * ```
 *
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
 * import * as Field from "@lucas-barake/effect-form/Field"
 * import * as Schema from "effect/Schema"
 *
 * // Array of primitives
 * const TagsField = Field.makeArrayField("tags", Schema.String)
 *
 * // Array of objects
 * const ItemsField = Field.makeArrayField("items", Schema.Struct({
 *   name: Schema.String,
 *   quantity: Schema.Number
 * }))
 * ```
 *
 * @category Constructors
 */
export const makeArrayField = <K extends string, S extends Schema.Schema.Any>(
  key: K,
  itemSchema: S,
): ArrayFieldDef<K, S> => ({
  _tag: "array",
  key,
  itemSchema,
})

/**
 * Extracts the encoded (input) type from a fields record.
 *
 * @category Type Helpers
 */
export type EncodedFromFields<T extends FieldsRecord> = {
  readonly [K in keyof T]: T[K] extends FieldDef<any, infer S> ? Schema.Schema.Encoded<S>
    : T[K] extends ArrayFieldDef<any, infer S> ? ReadonlyArray<Schema.Schema.Encoded<S>>
    : never
}

/**
 * Extracts the decoded (output) type from a fields record.
 *
 * @category Type Helpers
 */
export type DecodedFromFields<T extends FieldsRecord> = {
  readonly [K in keyof T]: T[K] extends FieldDef<any, infer S> ? Schema.Schema.Type<S>
    : T[K] extends ArrayFieldDef<any, infer S> ? ReadonlyArray<Schema.Schema.Type<S>>
    : never
}

/**
 * Gets a default encoded value from a schema.
 *
 * @category Helpers
 */
export const getDefaultFromSchema = (schema: Schema.Schema.Any): unknown => {
  const ast = schema.ast
  switch (ast._tag) {
    case "StringKeyword":
    case "TemplateLiteral":
      return ""
    case "NumberKeyword":
      return 0
    case "BooleanKeyword":
      return false
    case "TypeLiteral": {
      const result: Record<string, unknown> = {}
      for (const prop of ast.propertySignatures) {
        result[prop.name as string] = getDefaultFromSchema(Schema.make(prop.type))
      }
      return result
    }
    case "Transformation":
      return getDefaultFromSchema(Schema.make(ast.from))
    case "Refinement":
      return getDefaultFromSchema(Schema.make(ast.from))
    case "Suspend":
      return getDefaultFromSchema(Schema.make(ast.f()))
    default:
      return ""
  }
}

/**
 * Gets default encoded values for a fields record.
 *
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
 * @category Helpers
 */
export const createTouchedRecord = (fields: FieldsRecord, value: boolean): Record<string, boolean> => {
  const result: Record<string, boolean> = {}
  for (const key of Object.keys(fields)) {
    result[key] = value
  }
  return result
}
