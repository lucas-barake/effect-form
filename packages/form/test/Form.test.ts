import { Form } from "@lucas-barake/effect-form"
import * as Schema from "effect/Schema"
import { describe, expect, it } from "vitest"

describe("Form", () => {
  describe("FormBuilder", () => {
    it("empty creates an empty FormBuilder", () => {
      expect(Form.isFormBuilder(Form.empty)).toBe(true)
      expect(Form.empty.fields).toEqual({})
    })

    it("addField adds a field to the builder", () => {
      const builder = Form.empty.addField("email", Schema.String)

      expect(Form.isFormBuilder(builder)).toBe(true)
      expect(builder.fields).toHaveProperty("email")
      expect(builder.fields.email._tag).toBe("field")
    })

    it("multiple addField calls accumulate fields", () => {
      const builder = Form.empty
        .addField("email", Schema.String)
        .addField("password", Schema.String)
        .addField("age", Schema.Number)

      expect(Object.keys(builder.fields)).toEqual(["email", "password", "age"])
    })

    it("addArray adds an array field", () => {
      const itemForm = Form.empty
        .addField("street", Schema.String)
        .addField("city", Schema.String)

      const builder = Form.empty
        .addField("name", Schema.String)
        .addArray("addresses", itemForm)

      expect(builder.fields.addresses._tag).toBe("array")
      expect(Form.isArrayFieldDef(builder.fields.addresses)).toBe(true)
    })

    it("merge combines two form builders", () => {
      const addressFields = Form.empty
        .addField("street", Schema.String)
        .addField("city", Schema.String)

      const builder = Form.empty
        .addField("name", Schema.String)
        .merge(addressFields)

      expect(Object.keys(builder.fields)).toEqual(["name", "street", "city"])
    })
  })

  describe("buildSchema", () => {
    it("builds a Schema from simple fields", () => {
      const builder = Form.empty
        .addField("email", Schema.String)
        .addField("age", Schema.Number)

      const schema = Form.buildSchema(builder)
      const result = Schema.decodeUnknownSync(schema)({ email: "test@example.com", age: 25 })

      expect(result).toEqual({ email: "test@example.com", age: 25 })
    })

    it("builds a Schema with array fields", () => {
      const itemForm = Form.empty.addField("name", Schema.String)

      const builder = Form.empty
        .addField("title", Schema.String)
        .addArray("items", itemForm)

      const schema = Form.buildSchema(builder)
      const result = Schema.decodeUnknownSync(schema)({
        title: "My List",
        items: [{ name: "Item 1" }, { name: "Item 2" }],
      })

      expect(result).toEqual({
        title: "My List",
        items: [{ name: "Item 1" }, { name: "Item 2" }],
      })
    })

    it("validates with schema constraints", () => {
      const Email = Schema.String.pipe(Schema.pattern(/@/))

      const builder = Form.empty.addField("email", Email)

      const schema = Form.buildSchema(builder)

      expect(() => Schema.decodeUnknownSync(schema)({ email: "invalid" })).toThrow()
      expect(Schema.decodeUnknownSync(schema)({ email: "valid@example.com" })).toEqual({
        email: "valid@example.com",
      })
    })

    it("applies refinements in buildSchema", () => {
      const builder = Form.empty
        .addField("password", Schema.String)
        .addField("confirmPassword", Schema.String)
        .refine((values, ctx) => {
          if (values.password !== values.confirmPassword) {
            return ctx.error("confirmPassword", "Passwords must match")
          }
        })

      const schema = Form.buildSchema(builder)

      expect(() => Schema.decodeUnknownSync(schema)({ password: "secret", confirmPassword: "different" })).toThrow()

      expect(
        Schema.decodeUnknownSync(schema)({ password: "secret", confirmPassword: "secret" }),
      ).toEqual({ password: "secret", confirmPassword: "secret" })
    })
  })

  describe("helpers", () => {
    it("getDefaultEncodedValues returns empty values", () => {
      const builder = Form.empty
        .addField("email", Schema.String)
        .addField("age", Schema.Number)

      const defaults = Form.getDefaultEncodedValues(builder.fields)

      expect(defaults).toEqual({ email: "", age: "" })
    })

    it("getDefaultEncodedValues returns empty array for array fields", () => {
      const itemForm = Form.empty.addField("name", Schema.String)
      const builder = Form.empty
        .addField("title", Schema.String)
        .addArray("items", itemForm)

      const defaults = Form.getDefaultEncodedValues(builder.fields)

      expect(defaults).toEqual({ title: "", items: [] })
    })

    it("createTouchedRecord creates record with given value", () => {
      const builder = Form.empty
        .addField("email", Schema.String)
        .addField("password", Schema.String)

      const touched = Form.createTouchedRecord(builder.fields, false)
      expect(touched).toEqual({ email: false, password: false })

      const allTouched = Form.createTouchedRecord(builder.fields, true)
      expect(allTouched).toEqual({ email: true, password: true })
    })
  })

  describe("type guards", () => {
    it("isFormBuilder correctly identifies FormBuilder", () => {
      expect(Form.isFormBuilder(Form.empty)).toBe(true)
      expect(Form.isFormBuilder({})).toBe(false)
      expect(Form.isFormBuilder(null)).toBe(false)
      expect(Form.isFormBuilder("string")).toBe(false)
    })

    it("isFieldDef and isArrayFieldDef work correctly", () => {
      const itemForm = Form.empty.addField("name", Schema.String)
      const builder = Form.empty
        .addField("email", Schema.String)
        .addArray("items", itemForm)

      expect(Form.isFieldDef(builder.fields.email)).toBe(true)
      expect(Form.isArrayFieldDef(builder.fields.email)).toBe(false)

      expect(Form.isArrayFieldDef(builder.fields.items)).toBe(true)
      expect(Form.isFieldDef(builder.fields.items)).toBe(false)
    })
  })
})
