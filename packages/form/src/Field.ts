import * as Schema from "effect/Schema"

export const TypeId: unique symbol = Symbol.for("@lucas-barake/effect-form/Field")

export type TypeId = typeof TypeId

export interface FieldDef<K extends string, S extends Schema.Schema.Any> {
  readonly _tag: "field"
  readonly key: K
  readonly schema: S
}

export interface ArrayFieldDef<K extends string, S extends Schema.Schema.Any> {
  readonly _tag: "array"
  readonly key: K
  readonly itemSchema: S
}

export type AnyFieldDef = FieldDef<string, Schema.Schema.Any> | ArrayFieldDef<string, Schema.Schema.Any>

export type FieldsRecord = Record<string, AnyFieldDef>

export const isArrayFieldDef = (def: AnyFieldDef): def is ArrayFieldDef<string, Schema.Schema.Any> =>
  def._tag === "array"

export const isFieldDef = (def: AnyFieldDef): def is FieldDef<string, Schema.Schema.Any> => def._tag === "field"

export const makeField = <K extends string, S extends Schema.Schema.Any>(
  key: K,
  schema: S,
): FieldDef<K, S> => ({
  _tag: "field",
  key,
  schema,
})

export const makeArrayField = <K extends string, S extends Schema.Schema.Any>(
  key: K,
  itemSchema: S,
): ArrayFieldDef<K, S> => ({
  _tag: "array",
  key,
  itemSchema,
})

export type EncodedFromFields<T extends FieldsRecord> = {
  readonly [K in keyof T]: T[K] extends FieldDef<any, infer S> ? Schema.Schema.Encoded<S>
    : T[K] extends ArrayFieldDef<any, infer S> ? ReadonlyArray<Schema.Schema.Encoded<S>>
    : never
}

export type DecodedFromFields<T extends FieldsRecord> = {
  readonly [K in keyof T]: T[K] extends FieldDef<any, infer S> ? Schema.Schema.Type<S>
    : T[K] extends ArrayFieldDef<any, infer S> ? ReadonlyArray<Schema.Schema.Type<S>>
    : never
}

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

export const createTouchedRecord = (fields: FieldsRecord, value: boolean): Record<string, boolean> => {
  const result: Record<string, boolean> = {}
  for (const key of Object.keys(fields)) {
    result[key] = value
  }
  return result
}
