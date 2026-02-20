import * as Schema from "effect/Schema"
import { describe, expect, it } from "vitest"
import * as Field from "../src/Field.js"

describe("Field", () => {
  describe("getDefaultFromSchema", () => {
    it("returns defaults for primitive keywords", () => {
      expect(Field.getDefaultFromSchema(Schema.Number)).toBe(0)
      expect(Field.getDefaultFromSchema(Schema.Boolean)).toBe(false)
    })

    it("unwraps refinements and transformations", () => {
      const refined = Schema.Number.pipe(Schema.check(Schema.isGreaterThan(1)))
      const transformed = Schema.Number.pipe(
        Schema.decodeTo(Schema.String, {
          decode: (value: number) => String(value),
          encode: (value: string) => Number(value)
        })
      )

      expect(Field.getDefaultFromSchema(refined)).toBe(0)
      expect(Field.getDefaultFromSchema(transformed)).toBe(0)
    })

    it("returns defaults for literals, enums, and unions", () => {
      const literal = Schema.Literal("pending")
      const enums = Schema.Enum({ Red: "red", Blue: "blue" })
      const union = Schema.Union([Schema.Literal("a"), Schema.Literal("b")])

      expect(Field.getDefaultFromSchema(literal)).toBe("pending")
      expect(Field.getDefaultFromSchema(enums)).toBe("red")
      expect(Field.getDefaultFromSchema(union)).toBe("a")
    })

    it("returns undefined for empty enums and unions", () => {
      const emptyEnums = Schema.Enum({}) as unknown as Schema.Top
      const emptyUnion = Schema.Union([]) as unknown as Schema.Top

      expect(Field.getDefaultFromSchema(emptyEnums)).toBeUndefined()
      expect(Field.getDefaultFromSchema(emptyUnion)).toBeUndefined()
    })
  })

  describe("getDefaultEncodedValues", () => {
    it("returns empty string for scalar fields", () => {
      const EmailField = Field.makeField("email", Schema.String)
      const AgeField = Field.makeField("age", Schema.Number)

      const fields = {
        email: EmailField,
        age: AgeField
      }

      const defaults = Field.getDefaultEncodedValues(fields)

      expect(defaults).toEqual({ email: "", age: "" })
    })

    it("returns empty array for array fields", () => {
      const TitleField = Field.makeField("title", Schema.String)
      const ItemsField = Field.makeArrayField("items", Schema.Struct({ name: Schema.String }))

      const fields = {
        title: TitleField,
        items: ItemsField
      }

      const defaults = Field.getDefaultEncodedValues(fields)

      expect(defaults).toEqual({ title: "", items: [] })
    })
  })

  describe("extractStructFieldDefs", () => {
    it("returns field defs for struct schema", () => {
      const schema = Schema.Struct({ name: Schema.String, age: Schema.Number })
      const defs = Field.extractStructFieldDefs(schema)

      expect(defs).toBeDefined()
      expect(defs).toHaveLength(2)
      expect(defs![0]!.key).toBe("name")
      expect(defs![1]!.key).toBe("age")
    })

    it("unwraps refinements, transformations, and suspends", () => {
      const base = Schema.Struct({ name: Schema.String, age: Schema.Number })
      const refined = base.pipe(Schema.check(Schema.makeFilter(() => true)))
      const transformed = base.pipe(
        Schema.decodeTo(base, {
          decode: (value: { readonly name: string; readonly age: number }) => value,
          encode: (value: { readonly name: string; readonly age: number }) => value
        })
      )
      const suspended = Schema.suspend(() => base)

      const refinedDefs = Field.extractStructFieldDefs(refined)
      const transformedDefs = Field.extractStructFieldDefs(transformed)
      const suspendedDefs = Field.extractStructFieldDefs(suspended)

      expect(refinedDefs).toBeDefined()
      expect(refinedDefs).toHaveLength(2)
      expect(refinedDefs![0]!.key).toBe("name")
      expect(refinedDefs![1]!.key).toBe("age")

      expect(transformedDefs).toBeDefined()
      expect(transformedDefs).toHaveLength(2)
      expect(transformedDefs![0]!.key).toBe("name")
      expect(transformedDefs![1]!.key).toBe("age")

      expect(suspendedDefs).toBeDefined()
      expect(suspendedDefs).toHaveLength(2)
      expect(suspendedDefs![0]!.key).toBe("name")
      expect(suspendedDefs![1]!.key).toBe("age")
    })

    it("returns undefined for non-struct schema", () => {
      const defs = Field.extractStructFieldDefs(Schema.String)
      expect(defs).toBeUndefined()
    })
  })

  describe("type guards", () => {
    it("isFieldDef identifies scalar field definitions", () => {
      const EmailField = Field.makeField("email", Schema.String)
      const ItemsField = Field.makeArrayField("items", Schema.Struct({ name: Schema.String }))

      expect(Field.isFieldDef(EmailField)).toBe(true)
      expect(Field.isFieldDef(ItemsField)).toBe(false)
    })

    it("isArrayFieldDef identifies array field definitions", () => {
      const EmailField = Field.makeField("email", Schema.String)
      const ItemsField = Field.makeArrayField("items", Schema.Struct({ name: Schema.String }))

      expect(Field.isArrayFieldDef(ItemsField)).toBe(true)
      expect(Field.isArrayFieldDef(EmailField)).toBe(false)
    })
  })
})
