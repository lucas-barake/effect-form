import * as Schema from "effect/Schema"
import { describe, expectTypeOf, it } from "vitest"
import type * as Field from "../src/Field.js"
import * as FormBuilder from "../src/FormBuilder.js"

type FieldsOf<B,> = B extends FormBuilder.FormBuilder<infer F, any> ? F : never

describe("FormBuilder type display", () => {
  const builder = FormBuilder.empty
    .addField("email", Schema.String)
    .addField("age", Schema.Number)
    .addField("active", Schema.Boolean)

  type TFields = FieldsOf<typeof builder>

  type FlatFields = {
    readonly email: Field.FieldDef<"email", typeof Schema.String>
    readonly age: Field.FieldDef<"age", typeof Schema.Number>
    readonly active: Field.FieldDef<"active", typeof Schema.Boolean>
  }

  it("EncodedFromFields of a 3-field builder is the expected flat object type", () => {
    expectTypeOf<Field.EncodedFromFields<TFields>>().toEqualTypeOf<{
      readonly email: string
      readonly age: number
      readonly active: boolean
    }>()
  })

  it("the builder's TFields parameter is assignable to/from the flat record form", () => {
    expectTypeOf<TFields>().toExtend<FlatFields>()
    expectTypeOf<FlatFields>().toExtend<TFields>()
    expectTypeOf<TFields>().toEqualTypeOf<FlatFields>()
  })

  it("merge produces the flattened union of both builders' fields", () => {
    const other = FormBuilder.empty.addField("name", Schema.String)
    const merged = builder.merge(other)
    type Merged = FieldsOf<typeof merged>

    expectTypeOf<Merged>().toEqualTypeOf<{
      readonly email: Field.FieldDef<"email", typeof Schema.String>
      readonly age: Field.FieldDef<"age", typeof Schema.Number>
      readonly active: Field.FieldDef<"active", typeof Schema.Boolean>
      readonly name: Field.FieldDef<"name", typeof Schema.String>
    }>()
    expectTypeOf<keyof Merged>().toEqualTypeOf<"email" | "age" | "active" | "name">()
  })
})
