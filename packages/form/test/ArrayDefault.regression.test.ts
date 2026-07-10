import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as Atom from "effect/unstable/reactivity/Atom"
import { describe, expect, it } from "vitest"
import * as Field from "../src/Field.js"
import * as FormAtoms from "../src/FormAtoms.js"
import * as FormBuilder from "../src/FormBuilder.js"

describe("getDefaultFromSchema arrays (regression)", () => {
  it("top-level array schema defaults to []", () => {
    expect(Field.getDefaultFromSchema(Schema.Array(Schema.String))).toEqual([])
  })

  it("array property inside a struct defaults to []", () => {
    const itemSchema = Schema.Struct({
      name: Schema.String,
      tags: Schema.Array(Schema.String)
    })
    expect(Field.getDefaultFromSchema(itemSchema)).toEqual({ name: "", tags: [] })
  })

  it("appendArrayItem produces a valid item when item schema has a nested array", () => {
    const runtime = Atom.runtime(Layer.empty)
    const ItemSchema = Schema.Struct({
      name: Schema.String,
      tags: Schema.Array(Schema.String)
    })
    const ItemsField = Field.makeArrayField("items", ItemSchema)
    const form = FormBuilder.empty.addField(ItemsField)
    const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

    const initialState = atoms.operations.createInitialState({ items: [] })
    const newState = atoms.operations.appendArrayItem(initialState, "items", ItemSchema)

    // The appended default item must round-trip through the item schema.
    expect(newState.values.items).toHaveLength(1)
    expect(() => Schema.decodeUnknownSync(ItemSchema)(newState.values.items[0])).not.toThrow()
    expect(newState.values.items[0]).toEqual({ name: "", tags: [] })
  })
})
