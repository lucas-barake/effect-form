import * as Atom from "@effect-atom/atom/Atom"
import * as Registry from "@effect-atom/atom/Registry"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { describe, expect, it } from "vitest"
import * as Form from "../src/Form.js"
import * as FormAtoms from "../src/FormAtoms.js"

const makeTestForm = () => {
  const NameField = Form.makeField("name", Schema.String)
  const EmailField = Form.makeField("email", Schema.String)
  return Form.empty.addField(NameField).addField(EmailField)
}

const makeArrayTestForm = () => {
  const NameField = Form.makeField("name", Schema.String)
  const itemForm = Form.empty.addField(NameField)

  const TitleField = Form.makeField("title", Schema.String)
  const ItemsField = Form.makeArrayField("items", itemForm)

  return Form.empty.addField(TitleField).addField(ItemsField)
}

describe("FormAtoms", () => {
  describe("make", () => {
    it("builds combined schema from form builder", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form })

      const result = Schema.decodeUnknownSync(atoms.combinedSchema)({
        name: "John",
        email: "john@example.com",
      })

      expect(result).toEqual({ name: "John", email: "john@example.com" })
    })
  })

  describe("operations.createInitialState", () => {
    it("creates correct initial state from default values", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form })

      const defaultValues = { name: "John", email: "john@test.com" }
      const state = atoms.operations.createInitialState(defaultValues)

      expect(state.values).toEqual(defaultValues)
      expect(state.initialValues).toEqual(defaultValues)
      expect(state.touched).toEqual({ name: false, email: false })
      expect(state.submitCount).toBe(0)
      expect(state.dirtyFields.size).toBe(0)
    })

    it("creates initial state for array form", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeArrayTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form })

      const defaultValues = {
        title: "My List",
        items: [{ name: "Item 1" }],
      }
      const state = atoms.operations.createInitialState(defaultValues)

      expect(state.values).toEqual(defaultValues)
      expect(state.initialValues).toEqual(defaultValues)
      expect(state.touched).toEqual({ title: false, items: false })
    })
  })

  describe("operations.createResetState", () => {
    it("resets to initial values", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form })

      const initialState = atoms.operations.createInitialState({
        name: "John",
        email: "john@test.com",
      })

      const modifiedState = {
        ...initialState,
        values: { name: "Jane", email: "jane@test.com" },
        touched: { name: true, email: true },
        submitCount: 3,
        dirtyFields: new Set(["name", "email"]),
      }

      const resetState = atoms.operations.createResetState(modifiedState)

      expect(resetState.values).toEqual(initialState.initialValues)
      expect(resetState.initialValues).toEqual(initialState.initialValues)
      expect(resetState.touched).toEqual({ name: false, email: false })
      expect(resetState.submitCount).toBe(0)
      expect(resetState.dirtyFields.size).toBe(0)
    })
  })

  describe("operations.createSubmitState", () => {
    it("marks all fields as touched and increments submit count", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form })

      const initialState = atoms.operations.createInitialState({
        name: "John",
        email: "john@test.com",
      })

      const submitState = atoms.operations.createSubmitState(initialState)

      expect(submitState.touched).toEqual({ name: true, email: true })
      expect(submitState.submitCount).toBe(1)
      expect(submitState.values).toEqual(initialState.values)
    })

    it("increments submit count on subsequent submits", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form })

      let state = atoms.operations.createInitialState({
        name: "John",
        email: "john@test.com",
      })

      state = atoms.operations.createSubmitState(state)
      expect(state.submitCount).toBe(1)

      state = atoms.operations.createSubmitState(state)
      expect(state.submitCount).toBe(2)

      state = atoms.operations.createSubmitState(state)
      expect(state.submitCount).toBe(3)
    })
  })

  describe("operations.setFieldValue", () => {
    it("updates value and marks field as dirty", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form })

      const initialState = atoms.operations.createInitialState({
        name: "John",
        email: "john@test.com",
      })

      const newState = atoms.operations.setFieldValue(initialState, "name", "Jane")

      expect(newState.values.name).toBe("Jane")
      expect(newState.values.email).toBe("john@test.com")
      expect(newState.dirtyFields.has("name")).toBe(true)
      expect(newState.dirtyFields.has("email")).toBe(false)
    })

    it("removes field from dirty set when value matches initial", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form })

      const initialState = atoms.operations.createInitialState({
        name: "John",
        email: "john@test.com",
      })

      let state = atoms.operations.setFieldValue(initialState, "name", "Jane")
      expect(state.dirtyFields.has("name")).toBe(true)

      state = atoms.operations.setFieldValue(state, "name", "John")
      expect(state.dirtyFields.has("name")).toBe(false)
    })

    it("updates nested array field values", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeArrayTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form })

      const initialState = atoms.operations.createInitialState({
        title: "My List",
        items: [{ name: "Item 1" }, { name: "Item 2" }],
      })

      const newState = atoms.operations.setFieldValue(initialState, "items[0].name", "Updated Item")

      expect(newState.values.items[0]!.name).toBe("Updated Item")
      expect(newState.values.items[1]!.name).toBe("Item 2")
    })
  })

  describe("operations.setFormValues", () => {
    it("updates all values and recalculates dirty fields", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form })

      const initialState = atoms.operations.createInitialState({
        name: "John",
        email: "john@test.com",
      })

      const newValues = { name: "Jane", email: "john@test.com" }
      const newState = atoms.operations.setFormValues(initialState, newValues)

      expect(newState.values).toEqual(newValues)
      expect(newState.dirtyFields.has("name")).toBe(true)
      expect(newState.dirtyFields.has("email")).toBe(false)
    })

    it("clears dirty fields when values match initial", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form })

      const initialValues = { name: "John", email: "john@test.com" }
      const initialState = atoms.operations.createInitialState(initialValues)

      let state = atoms.operations.setFormValues(initialState, {
        name: "Jane",
        email: "jane@test.com",
      })
      expect(state.dirtyFields.size).toBe(2)

      state = atoms.operations.setFormValues(state, initialValues)
      expect(state.dirtyFields.size).toBe(0)
    })
  })

  describe("operations.setFieldTouched", () => {
    it("marks field as touched", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form })

      const initialState = atoms.operations.createInitialState({
        name: "John",
        email: "john@test.com",
      })

      const newState = atoms.operations.setFieldTouched(initialState, "name", true)

      expect(newState.touched.name).toBe(true)
      expect(newState.touched.email).toBe(false)
    })

    it("can unmark field as touched", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form })

      let state = atoms.operations.createInitialState({
        name: "John",
        email: "john@test.com",
      })

      state = atoms.operations.setFieldTouched(state, "name", true)
      expect(state.touched.name).toBe(true)

      state = atoms.operations.setFieldTouched(state, "name", false)
      expect(state.touched.name).toBe(false)
    })
  })

  describe("operations.appendArrayItem", () => {
    it("adds item to array and updates dirty fields", () => {
      const runtime = Atom.runtime(Layer.empty)
      const NameField = Form.makeField("name", Schema.String)
      const itemForm = Form.empty.addField(NameField)
      const TitleField = Form.makeField("title", Schema.String)
      const ItemsField = Form.makeArrayField("items", itemForm)
      const form = Form.empty.addField(TitleField).addField(ItemsField)

      const atoms = FormAtoms.make({ runtime, formBuilder: form })

      const initialState = atoms.operations.createInitialState({
        title: "My List",
        items: [],
      })

      const newState = atoms.operations.appendArrayItem(
        initialState,
        "items",
        itemForm,
        { name: "New Item" },
      )

      expect(newState.values.items).toHaveLength(1)
      expect(newState.values.items[0]).toEqual({ name: "New Item" })
      expect(newState.dirtyFields.has("items")).toBe(true)
    })

    it("uses default values when no value provided", () => {
      const runtime = Atom.runtime(Layer.empty)
      const NameField = Form.makeField("name", Schema.String)
      const itemForm = Form.empty.addField(NameField)
      const TitleField = Form.makeField("title", Schema.String)
      const ItemsField = Form.makeArrayField("items", itemForm)
      const form = Form.empty.addField(TitleField).addField(ItemsField)

      const atoms = FormAtoms.make({ runtime, formBuilder: form })

      const initialState = atoms.operations.createInitialState({
        title: "My List",
        items: [],
      })

      const newState = atoms.operations.appendArrayItem(initialState, "items", itemForm)

      expect(newState.values.items).toHaveLength(1)
      expect(newState.values.items[0]).toEqual({ name: "" })
    })
  })

  describe("operations.removeArrayItem", () => {
    it("removes item from array and updates dirty fields", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeArrayTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form })

      const initialState = atoms.operations.createInitialState({
        title: "My List",
        items: [{ name: "Item 1" }, { name: "Item 2" }, { name: "Item 3" }],
      })

      const newState = atoms.operations.removeArrayItem(initialState, "items", 1)

      expect(newState.values.items).toHaveLength(2)
      expect(newState.values.items[0]).toEqual({ name: "Item 1" })
      expect(newState.values.items[1]).toEqual({ name: "Item 3" })
    })

    it("handles out of bounds index gracefully (no items match filter)", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeArrayTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form })

      const initialState = atoms.operations.createInitialState({
        title: "My List",
        items: [{ name: "Item 1" }],
      })

      const newState = atoms.operations.removeArrayItem(initialState, "items", 999)

      expect(newState.values.items).toHaveLength(1)
      expect(newState.values.items[0]).toEqual({ name: "Item 1" })
    })
  })

  describe("operations.swapArrayItems", () => {
    it("swaps two items in array", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeArrayTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form })

      const initialState = atoms.operations.createInitialState({
        title: "My List",
        items: [{ name: "A" }, { name: "B" }, { name: "C" }],
      })

      const newState = atoms.operations.swapArrayItems(initialState, "items", 0, 2)

      expect(newState.values.items[0]).toEqual({ name: "C" })
      expect(newState.values.items[1]).toEqual({ name: "B" })
      expect(newState.values.items[2]).toEqual({ name: "A" })
    })

    it("returns same state when indices are out of bounds or equal", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeArrayTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form })

      const initialState = atoms.operations.createInitialState({
        title: "My List",
        items: [{ name: "A" }],
      })

      // swapArrayItems has bounds checking - returns unchanged state if indices are invalid
      const newState = atoms.operations.swapArrayItems(initialState, "items", 0, 999)

      // State should be unchanged
      expect(newState).toBe(initialState)
      expect(newState.values.items).toHaveLength(1)
      expect(newState.values.items[0]).toEqual({ name: "A" })
    })
  })

  describe("operations.moveArrayItem", () => {
    it("moves item from one position to another", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeArrayTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form })

      const initialState = atoms.operations.createInitialState({
        title: "My List",
        items: [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }],
      })

      const newState = atoms.operations.moveArrayItem(initialState, "items", 0, 2)

      expect(newState.values.items[0]).toEqual({ name: "B" })
      expect(newState.values.items[1]).toEqual({ name: "C" })
      expect(newState.values.items[2]).toEqual({ name: "A" })
      expect(newState.values.items[3]).toEqual({ name: "D" })
    })

    it("handles moving from end to beginning", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeArrayTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form })

      const initialState = atoms.operations.createInitialState({
        title: "My List",
        items: [{ name: "A" }, { name: "B" }, { name: "C" }],
      })

      const newState = atoms.operations.moveArrayItem(initialState, "items", 2, 0)

      expect(newState.values.items[0]).toEqual({ name: "C" })
      expect(newState.values.items[1]).toEqual({ name: "A" })
      expect(newState.values.items[2]).toEqual({ name: "B" })
    })

    it("returns same state when indices are out of bounds or equal", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeArrayTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form })

      const initialState = atoms.operations.createInitialState({
        title: "My List",
        items: [{ name: "A" }],
      })

      // moveArrayItem has bounds checking - returns unchanged state if indices are invalid
      const newState = atoms.operations.moveArrayItem(initialState, "items", 999, 0)

      // State should be unchanged
      expect(newState).toBe(initialState)
      expect(newState.values.items).toHaveLength(1)
      expect(newState.values.items[0]).toEqual({ name: "A" })
    })
  })

  describe("getOrCreateFieldAtoms", () => {
    it("creates all expected field atoms", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form })
      const registry = Registry.make()

      registry.set(
        atoms.stateAtom,
        Option.some(atoms.operations.createInitialState({ name: "John", email: "test@test.com" })),
      )

      const fieldAtoms = atoms.getOrCreateFieldAtoms("name")

      expect(fieldAtoms.valueAtom).toBeDefined()
      expect(fieldAtoms.initialValueAtom).toBeDefined()
      expect(fieldAtoms.touchedAtom).toBeDefined()
      expect(fieldAtoms.crossFieldErrorAtom).toBeDefined()
    })
  })

  describe("resetValidationAtoms", () => {
    it("clears both registries", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form })
      const registry = Registry.make()

      registry.set(
        atoms.stateAtom,
        Option.some(atoms.operations.createInitialState({ name: "John", email: "test@test.com" })),
      )

      atoms.getOrCreateFieldAtoms("name")
      atoms.getOrCreateValidationAtom("name", Schema.String)

      expect(atoms.fieldAtomsRegistry.get("name")).toBeDefined()
      expect(atoms.validationAtomsRegistry.get("name")).toBeDefined()

      atoms.resetValidationAtoms(registry)

      expect(atoms.fieldAtomsRegistry.get("name")).toBeUndefined()
      expect(atoms.validationAtomsRegistry.get("name")).toBeUndefined()
    })
  })

  describe("derived atoms", () => {
    it("dirtyFieldsAtom reflects state", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form })
      const registry = Registry.make()

      const initialState = atoms.operations.createInitialState({
        name: "John",
        email: "test@test.com",
      })

      registry.set(atoms.stateAtom, Option.some(initialState))
      expect(registry.get(atoms.dirtyFieldsAtom).size).toBe(0)

      const modifiedState = atoms.operations.setFieldValue(initialState, "name", "Jane")
      registry.set(atoms.stateAtom, Option.some(modifiedState))
      expect(registry.get(atoms.dirtyFieldsAtom).has("name")).toBe(true)
    })

    it("isDirtyAtom reflects dirty state", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form })
      const registry = Registry.make()

      const initialState = atoms.operations.createInitialState({
        name: "John",
        email: "test@test.com",
      })

      registry.set(atoms.stateAtom, Option.some(initialState))
      expect(registry.get(atoms.isDirtyAtom)).toBe(false)

      const modifiedState = atoms.operations.setFieldValue(initialState, "name", "Jane")
      registry.set(atoms.stateAtom, Option.some(modifiedState))
      expect(registry.get(atoms.isDirtyAtom)).toBe(true)
    })

    it("submitCountAtom reflects submit count", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form })
      const registry = Registry.make()

      const initialState = atoms.operations.createInitialState({
        name: "John",
        email: "test@test.com",
      })

      registry.set(atoms.stateAtom, Option.some(initialState))
      expect(registry.get(atoms.submitCountAtom)).toBe(0)

      const submitState = atoms.operations.createSubmitState(initialState)
      registry.set(atoms.stateAtom, Option.some(submitState))
      expect(registry.get(atoms.submitCountAtom)).toBe(1)
    })
  })
})
