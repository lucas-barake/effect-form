import * as Schema from "effect/Schema"
import * as AST from "effect/SchemaAST"

export const TypeId: unique symbol = Symbol.for("@lucas-barake/effect-form/Field")

export type TypeId = typeof TypeId

export interface FieldDef<K extends string, S extends Schema.Top,> {
  readonly _tag: "field"
  readonly key: K
  readonly schema: S
}

export interface ArrayFieldDef<K extends string, S extends Schema.Top,> {
  readonly _tag: "array"
  readonly key: K
  readonly itemSchema: S
}

export type AnyFieldDef = FieldDef<string, Schema.Top> | ArrayFieldDef<string, Schema.Top>

export type FieldsRecord = Record<string, AnyFieldDef>

export const isArrayFieldDef = (def: AnyFieldDef): def is ArrayFieldDef<string, Schema.Top> => def._tag === "array"

export const isFieldDef = (def: AnyFieldDef): def is FieldDef<string, Schema.Top> => def._tag === "field"

export const makeField = <K extends string, S extends Schema.Top,>(
  key: K,
  schema: S
): FieldDef<K, S> => ({
  _tag: "field",
  key,
  schema
})

export const makeArrayField = <K extends string, S extends Schema.Top,>(
  key: K,
  itemSchema: S
): ArrayFieldDef<K, S> => ({
  _tag: "array",
  key,
  itemSchema
})

export type EncodedFromFields<T extends FieldsRecord,> = {
  readonly [K in keyof T]: T[K] extends FieldDef<any, infer S> ? Schema.Codec.Encoded<S>
    : T[K] extends ArrayFieldDef<any, infer S> ? ReadonlyArray<Schema.Codec.Encoded<S>>
    : never
}

export type DecodedFromFields<T extends FieldsRecord,> = {
  readonly [K in keyof T]: T[K] extends FieldDef<any, infer S> ? Schema.Schema.Type<S>
    : T[K] extends ArrayFieldDef<any, infer S> ? ReadonlyArray<Schema.Schema.Type<S>>
    : never
}

export const getDefaultFromSchema = (schema: Schema.Top): unknown => {
  const ast = AST.toEncoded(schema.ast)
  switch (ast._tag) {
    case "String":
    case "TemplateLiteral":
      return ""
    case "Number":
      return 0
    case "Boolean":
      return false
    case "Arrays":
      return []
    case "Literal":
      return ast.literal
    case "Enum": {
      const first = ast.enums[0]
      return first ? first[1] : undefined
    }
    case "Objects": {
      const result: Record<string, unknown> = {}
      for (const prop of ast.propertySignatures) {
        result[prop.name as string] = getDefaultFromSchema(Schema.make(prop.type))
      }
      return result
    }
    case "Union": {
      const first = ast.types[0]
      return first ? getDefaultFromSchema(Schema.make(first)) : undefined
    }
    case "Never":
      return undefined
    case "Suspend":
      return getDefaultFromSchema(Schema.make(ast.thunk()))
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

export const extractStructFieldDefs = (
  schema: Schema.Top
): ReadonlyArray<FieldDef<string, Schema.Top>> | undefined => {
  const unwrapObjects = (ast: AST.AST): AST.Objects | undefined => {
    const base = AST.toType(ast)
    if (AST.isObjects(base)) return base
    if (AST.isSuspend(base)) return unwrapObjects(base.thunk())
    return undefined
  }

  const objects = unwrapObjects(schema.ast)
  if (!objects) return undefined

  return objects.propertySignatures.map((prop) => makeField(prop.name as string, { ast: prop.type } as Schema.Top))
}
