import * as Schema from "effect/Schema"
import { describe, expect, it } from "vitest"
import * as Field from "../src/Field.js"

describe("Field", () => {
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
