import * as Atom from "@effect-atom/atom/Atom"
import * as Registry from "@effect-atom/atom/Registry"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { describe, expect, it, vi } from "vitest"
import * as Field from "../src/Field.js"
import * as FormAtoms from "../src/FormAtoms.js"
import * as FormBuilder from "../src/FormBuilder.js"

const makeTestForm = () => {
  const NameField = Field.makeField("name", Schema.String)
  const EmailField = Field.makeField("email", Schema.String)
  return FormBuilder.empty.addField(NameField).addField(EmailField)
}

const makeArrayTestForm = () => {
  const TitleField = Field.makeField("title", Schema.String)
  const ItemsField = Field.makeArrayField("items", Schema.Struct({ name: Schema.String }))

  return FormBuilder.empty.addField(TitleField).addField(ItemsField)
}

describe("FormAtoms", () => {
  describe("make", () => {
    it("builds combined schema from form builder", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

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
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

      const defaultValues = { name: "John", email: "john@test.com" }
      const state = atoms.operations.createInitialState(defaultValues)

      expect(state.values).toEqual(defaultValues)
      expect(state.initialValues).toEqual(defaultValues)
      expect(Option.isNone(state.lastSubmittedValues)).toBe(true)
      expect(state.touched).toEqual({ name: false, email: false })
      expect(state.submitCount).toBe(0)
      expect(state.dirtyFields.size).toBe(0)
    })

    it("creates initial state for array form", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeArrayTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

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
    it("resets all state including lastSubmittedValues", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

      let state = atoms.operations.createInitialState({
        name: "John",
        email: "john@test.com",
      })

      state = atoms.operations.setFieldValue(state, "name", "Jane")
      state = atoms.operations.createSubmitState(state)
      state = {
        ...state,
        lastSubmittedValues: Option.some({
          encoded: state.values,
          decoded: state.values,
        }),
      }
      expect(Option.isSome(state.lastSubmittedValues)).toBe(true)

      const resetState = atoms.operations.createResetState(state)

      expect(resetState.values).toEqual({ name: "John", email: "john@test.com" })
      expect(resetState.initialValues).toEqual({ name: "John", email: "john@test.com" })
      expect(Option.isNone(resetState.lastSubmittedValues)).toBe(true)
      expect(resetState.touched).toEqual({ name: false, email: false })
      expect(resetState.submitCount).toBe(0)
      expect(resetState.dirtyFields.size).toBe(0)
    })
  })

  describe("operations.createSubmitState", () => {
    it("marks all fields as touched and increments submit count", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

      const initialState = atoms.operations.createInitialState({
        name: "John",
        email: "john@test.com",
      })

      const submitState = atoms.operations.createSubmitState(initialState)

      expect(submitState.touched).toEqual({ name: true, email: true })
      expect(submitState.submitCount).toBe(1)
      expect(submitState.values).toEqual(initialState.values)
    })

    it("does not set lastSubmittedValues", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

      const initialState = atoms.operations.createInitialState({
        name: "John",
        email: "john@test.com",
      })

      const modifiedState = atoms.operations.setFieldValue(initialState, "name", "Jane")

      const submitState = atoms.operations.createSubmitState(modifiedState)

      expect(Option.isNone(submitState.lastSubmittedValues)).toBe(true)
    })

    it("increments submit count on subsequent submits", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

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
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

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
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

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
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

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
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

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
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

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
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

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
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

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
      const TitleField = Field.makeField("title", Schema.String)
      const ItemSchema = Schema.Struct({ name: Schema.String })
      const ItemsField = Field.makeArrayField("items", ItemSchema)
      const form = FormBuilder.empty.addField(TitleField).addField(ItemsField)

      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

      const initialState = atoms.operations.createInitialState({
        title: "My List",
        items: [],
      })

      const newState = atoms.operations.appendArrayItem(
        initialState,
        "items",
        ItemSchema,
        { name: "New Item" },
      )

      expect(newState.values.items).toHaveLength(1)
      expect(newState.values.items[0]).toEqual({ name: "New Item" })
      expect(newState.dirtyFields.has("items")).toBe(true)
    })

    it("uses default values when no value provided", () => {
      const runtime = Atom.runtime(Layer.empty)
      const TitleField = Field.makeField("title", Schema.String)
      const ItemSchema = Schema.Struct({ name: Schema.String })
      const ItemsField = Field.makeArrayField("items", ItemSchema)
      const form = FormBuilder.empty.addField(TitleField).addField(ItemsField)

      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

      const initialState = atoms.operations.createInitialState({
        title: "My List",
        items: [],
      })

      const newState = atoms.operations.appendArrayItem(initialState, "items", ItemSchema)

      expect(newState.values.items).toHaveLength(1)
      expect(newState.values.items[0]).toEqual({ name: "" })
    })
  })

  describe("operations.removeArrayItem", () => {
    it("removes item from array and updates dirty fields", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeArrayTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

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
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

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
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

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
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

      const initialState = atoms.operations.createInitialState({
        title: "My List",
        items: [{ name: "A" }],
      })

      const newState = atoms.operations.swapArrayItems(initialState, "items", 0, 999)

      expect(newState).toBe(initialState)
      expect(newState.values.items).toHaveLength(1)
      expect(newState.values.items[0]).toEqual({ name: "A" })
    })
  })

  describe("operations.moveArrayItem", () => {
    it("moves item from one position to another", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeArrayTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

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
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

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
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

      const initialState = atoms.operations.createInitialState({
        title: "My List",
        items: [{ name: "A" }],
      })

      const newState = atoms.operations.moveArrayItem(initialState, "items", 999, 0)

      expect(newState).toBe(initialState)
      expect(newState.values.items).toHaveLength(1)
      expect(newState.values.items[0]).toEqual({ name: "A" })
    })
  })

  describe("operations.revertToLastSubmit", () => {
    it("returns same state when lastSubmittedValues is None", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

      const initialState = atoms.operations.createInitialState({
        name: "John",
        email: "john@test.com",
      })

      const modifiedState = atoms.operations.setFieldValue(initialState, "name", "Jane")

      const revertedState = atoms.operations.revertToLastSubmit(modifiedState)

      expect(revertedState).toBe(modifiedState)
    })

    it("returns same state when values already match lastSubmittedValues", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

      let state = atoms.operations.createInitialState({
        name: "John",
        email: "john@test.com",
      })

      state = atoms.operations.createSubmitState(state)
      state = {
        ...state,
        lastSubmittedValues: Option.some({
          encoded: state.values,
          decoded: state.values,
        }),
      }
      const revertedState = atoms.operations.revertToLastSubmit(state)

      expect(revertedState).toBe(state)
    })

    it("restores values to lastSubmittedValues and recalculates dirtyFields", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

      let state = atoms.operations.createInitialState({
        name: "John",
        email: "john@test.com",
      })

      state = atoms.operations.setFieldValue(state, "name", "Jane")
      state = atoms.operations.createSubmitState(state)
      state = {
        ...state,
        lastSubmittedValues: Option.some({
          encoded: state.values,
          decoded: state.values,
        }),
      }
      state = atoms.operations.setFieldValue(state, "name", "Bob")
      expect(state.values.name).toBe("Bob")
      expect(state.dirtyFields.has("name")).toBe(true)

      const revertedState = atoms.operations.revertToLastSubmit(state)

      expect(revertedState.values.name).toBe("Jane")
      expect(revertedState.dirtyFields.has("name")).toBe(true)
    })

    it("clears dirtyFields when reverting makes values match initial", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

      let state = atoms.operations.createInitialState({
        name: "John",
        email: "john@test.com",
      })

      state = atoms.operations.createSubmitState(state)
      state = {
        ...state,
        lastSubmittedValues: Option.some({
          encoded: state.values,
          decoded: state.values,
        }),
      }
      state = atoms.operations.setFieldValue(state, "name", "Jane")
      expect(state.dirtyFields.has("name")).toBe(true)

      const revertedState = atoms.operations.revertToLastSubmit(state)

      expect(revertedState.values.name).toBe("John")
      expect(revertedState.dirtyFields.has("name")).toBe(false)
    })
  })

  describe("getOrCreateFieldAtoms", () => {
    it("creates all expected field atoms", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })
      const registry = Registry.make()

      registry.set(
        atoms.stateAtom,
        Option.some(atoms.operations.createInitialState({ name: "John", email: "test@test.com" })),
      )

      const fieldAtoms = atoms.getOrCreateFieldAtoms("name")

      expect(fieldAtoms.valueAtom).toBeDefined()
      expect(fieldAtoms.initialValueAtom).toBeDefined()
      expect(fieldAtoms.touchedAtom).toBeDefined()
      expect(fieldAtoms.errorAtom).toBeDefined()
    })
  })

  describe("resetValidationAtoms", () => {
    it("clears both registries", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })
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
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })
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
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })
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
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })
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

    it("lastSubmittedValuesAtom reflects lastSubmittedValues", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })
      const registry = Registry.make()

      const initialState = atoms.operations.createInitialState({
        name: "John",
        email: "test@test.com",
      })

      registry.set(atoms.stateAtom, Option.some(initialState))
      expect(Option.isNone(registry.get(atoms.lastSubmittedValuesAtom))).toBe(true)

      let submitState = atoms.operations.createSubmitState(initialState)
      submitState = {
        ...submitState,
        lastSubmittedValues: Option.some({
          encoded: submitState.values,
          decoded: submitState.values,
        }),
      }
      registry.set(atoms.stateAtom, Option.some(submitState))
      expect(Option.isSome(registry.get(atoms.lastSubmittedValuesAtom))).toBe(true)
      expect(Option.getOrThrow(registry.get(atoms.lastSubmittedValuesAtom)).encoded).toEqual({
        name: "John",
        email: "test@test.com",
      })
    })

    it("hasChangedSinceSubmitAtom returns false before first submit", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })
      const registry = Registry.make()

      const initialState = atoms.operations.createInitialState({
        name: "John",
        email: "test@test.com",
      })

      const modifiedState = atoms.operations.setFieldValue(initialState, "name", "Jane")
      registry.set(atoms.stateAtom, Option.some(modifiedState))
      expect(registry.get(atoms.hasChangedSinceSubmitAtom)).toBe(false)
    })

    it("hasChangedSinceSubmitAtom returns false right after submit", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })
      const registry = Registry.make()

      let state = atoms.operations.createInitialState({
        name: "John",
        email: "test@test.com",
      })

      state = atoms.operations.createSubmitState(state)
      state = {
        ...state,
        lastSubmittedValues: Option.some({
          encoded: state.values,
          decoded: state.values,
        }),
      }
      registry.set(atoms.stateAtom, Option.some(state))
      expect(registry.get(atoms.hasChangedSinceSubmitAtom)).toBe(false)
    })

    it("hasChangedSinceSubmitAtom returns true after changes post-submit", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })
      const registry = Registry.make()

      let state = atoms.operations.createInitialState({
        name: "John",
        email: "test@test.com",
      })

      state = atoms.operations.createSubmitState(state)
      state = {
        ...state,
        lastSubmittedValues: Option.some({
          encoded: state.values,
          decoded: state.values,
        }),
      }
      state = atoms.operations.setFieldValue(state, "name", "Jane")
      registry.set(atoms.stateAtom, Option.some(state))
      expect(registry.get(atoms.hasChangedSinceSubmitAtom)).toBe(true)
    })

    it("changedSinceSubmitFieldsAtom returns correct fields after changes post-submit", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })
      const registry = Registry.make()

      let state = atoms.operations.createInitialState({
        name: "John",
        email: "test@test.com",
      })

      state = atoms.operations.createSubmitState(state)
      state = {
        ...state,
        lastSubmittedValues: Option.some({
          encoded: state.values,
          decoded: state.values,
        }),
      }
      state = atoms.operations.setFieldValue(state, "name", "Jane")
      registry.set(atoms.stateAtom, Option.some(state))

      const changedFields = registry.get(atoms.changedSinceSubmitFieldsAtom)
      expect(changedFields.has("name")).toBe(true)
      expect(changedFields.has("email")).toBe(false)
    })

    it("changedSinceSubmitFieldsAtom tracks array item changes after submit", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeArrayTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })
      const registry = Registry.make()

      let state = atoms.operations.createInitialState({
        title: "My List",
        items: [{ name: "Item A" }, { name: "Item B" }],
      })

      state = atoms.operations.createSubmitState(state)
      state = {
        ...state,
        lastSubmittedValues: Option.some({
          encoded: state.values,
          decoded: state.values,
        }),
      }
      state = atoms.operations.setFieldValue(state, "items[1].name", "Item C")
      registry.set(atoms.stateAtom, Option.some(state))

      const changedFields = registry.get(atoms.changedSinceSubmitFieldsAtom)
      expect(changedFields.has("items[1].name")).toBe(true)
      expect(changedFields.has("items[0].name")).toBe(false)
      expect(changedFields.has("title")).toBe(false)
    })

    it("hasChangedSinceSubmitAtom detects array append after submit", () => {
      const runtime = Atom.runtime(Layer.empty)
      const TitleField = Field.makeField("title", Schema.String)
      const ItemSchema = Schema.Struct({ name: Schema.String })
      const ItemsField = Field.makeArrayField("items", ItemSchema)
      const form = FormBuilder.empty.addField(TitleField).addField(ItemsField)
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })
      const registry = Registry.make()

      let state = atoms.operations.createInitialState({
        title: "My List",
        items: [{ name: "Item A" }],
      })

      state = atoms.operations.createSubmitState(state)
      state = {
        ...state,
        lastSubmittedValues: Option.some({
          encoded: state.values,
          decoded: state.values,
        }),
      }
      state = atoms.operations.appendArrayItem(state, "items", ItemSchema, { name: "Item B" })
      registry.set(atoms.stateAtom, Option.some(state))

      expect(registry.get(atoms.hasChangedSinceSubmitAtom)).toBe(true)
    })

    it("revertToLastSubmit restores to most recent submit (not earlier ones)", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })

      let state = atoms.operations.createInitialState({
        name: "John",
        email: "john@test.com",
      })

      state = atoms.operations.setFieldValue(state, "name", "Jane")
      state = atoms.operations.createSubmitState(state)
      state = {
        ...state,
        lastSubmittedValues: Option.some({
          encoded: state.values,
          decoded: state.values,
        }),
      }
      expect(Option.getOrThrow(state.lastSubmittedValues).encoded.name).toBe("Jane")

      state = atoms.operations.setFieldValue(state, "name", "Bob")
      state = atoms.operations.createSubmitState(state)
      state = {
        ...state,
        lastSubmittedValues: Option.some({
          encoded: state.values,
          decoded: state.values,
        }),
      }
      expect(Option.getOrThrow(state.lastSubmittedValues).encoded.name).toBe("Bob")

      state = atoms.operations.setFieldValue(state, "name", "Charlie")
      expect(state.values.name).toBe("Charlie")

      const revertedState = atoms.operations.revertToLastSubmit(state)
      expect(revertedState.values.name).toBe("Bob")
    })

    it("changedSinceSubmitFieldsAtom handles nested object changes", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeArrayTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })
      const registry = Registry.make()

      let state = atoms.operations.createInitialState({
        title: "My List",
        items: [{ name: "Item A" }],
      })

      state = atoms.operations.createSubmitState(state)
      state = {
        ...state,
        lastSubmittedValues: Option.some({
          encoded: state.values,
          decoded: state.values,
        }),
      }

      state = atoms.operations.setFieldValue(state, "items[0].name", "Updated")
      registry.set(atoms.stateAtom, Option.some(state))

      expect(registry.get(atoms.hasChangedSinceSubmitAtom)).toBe(true)
      expect(registry.get(atoms.changedSinceSubmitFieldsAtom).has("items[0].name")).toBe(true)
    })
  })

  describe("resetAtom", () => {
    it("resets form to initial state and clears cross-field errors", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })
      const registry = Registry.make()

      const initialState = atoms.operations.createInitialState({
        name: "John",
        email: "john@test.com",
      })
      registry.set(atoms.stateAtom, Option.some(initialState))

      let state = atoms.operations.setFieldValue(initialState, "name", "Jane")
      state = atoms.operations.createSubmitState(state)
      state = {
        ...state,
        lastSubmittedValues: Option.some({
          encoded: state.values,
          decoded: state.values,
        }),
      }
      registry.set(atoms.stateAtom, Option.some(state))
      registry.set(atoms.errorsAtom, new Map([["name", { message: "Some error", source: "field" }]]))

      expect(registry.get(atoms.stateAtom).pipe(Option.getOrThrow).values.name).toBe("Jane")
      expect(Option.isSome(registry.get(atoms.stateAtom).pipe(Option.getOrThrow).lastSubmittedValues)).toBe(true)
      expect(registry.get(atoms.errorsAtom).size).toBe(1)

      registry.mount(atoms.resetAtom)
      registry.set(atoms.resetAtom, undefined)

      const resetState = registry.get(atoms.stateAtom).pipe(Option.getOrThrow)
      expect(resetState.values.name).toBe("John")
      expect(Option.isNone(resetState.lastSubmittedValues)).toBe(true)
      expect(resetState.submitCount).toBe(0)
      expect(registry.get(atoms.errorsAtom).size).toBe(0)
    })
  })

  describe("revertToLastSubmitAtom", () => {
    it("reverts form values to last submitted state and clears cross-field errors", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })
      const registry = Registry.make()

      let state = atoms.operations.createInitialState({
        name: "John",
        email: "john@test.com",
      })
      state = atoms.operations.setFieldValue(state, "name", "Jane")
      state = atoms.operations.createSubmitState(state)
      state = {
        ...state,
        lastSubmittedValues: Option.some({
          encoded: state.values,
          decoded: state.values,
        }),
      }
      registry.set(atoms.stateAtom, Option.some(state))

      state = atoms.operations.setFieldValue(state, "name", "Bob")
      registry.set(atoms.stateAtom, Option.some(state))
      registry.set(atoms.errorsAtom, new Map([["name", { message: "Validation error", source: "field" }]]))

      expect(registry.get(atoms.stateAtom).pipe(Option.getOrThrow).values.name).toBe("Bob")

      registry.mount(atoms.revertToLastSubmitAtom)
      registry.set(atoms.revertToLastSubmitAtom, undefined)

      const revertedState = registry.get(atoms.stateAtom).pipe(Option.getOrThrow)
      expect(revertedState.values.name).toBe("Jane")
      expect(registry.get(atoms.errorsAtom).size).toBe(0)
    })
  })

  describe("setValuesAtom", () => {
    it("sets all form values and clears cross-field errors", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })
      const registry = Registry.make()

      const initialState = atoms.operations.createInitialState({
        name: "John",
        email: "john@test.com",
      })
      registry.set(atoms.stateAtom, Option.some(initialState))
      registry.set(atoms.errorsAtom, new Map([["email", { message: "Invalid email", source: "field" }]]))

      registry.mount(atoms.setValuesAtom)
      registry.set(atoms.setValuesAtom, { name: "Alice", email: "alice@test.com" })

      const newState = registry.get(atoms.stateAtom).pipe(Option.getOrThrow)
      expect(newState.values.name).toBe("Alice")
      expect(newState.values.email).toBe("alice@test.com")
      expect(newState.dirtyFields.has("name")).toBe(true)
      expect(newState.dirtyFields.has("email")).toBe(true)
      expect(registry.get(atoms.errorsAtom).size).toBe(0)
    })
  })

  describe("setValue", () => {
    it("sets a single field value", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })
      const registry = Registry.make()

      const initialState = atoms.operations.createInitialState({
        name: "John",
        email: "john@test.com",
      })
      registry.set(atoms.stateAtom, Option.some(initialState))

      const setNameAtom = atoms.setValue(atoms.fieldRefs.name)

      registry.mount(setNameAtom)
      registry.set(setNameAtom, "Alice")

      const newState = registry.get(atoms.stateAtom).pipe(Option.getOrThrow)
      expect(newState.values.name).toBe("Alice")
      expect(newState.values.email).toBe("john@test.com")
      expect(newState.dirtyFields.has("name")).toBe(true)
      expect(newState.dirtyFields.has("email")).toBe(false)
    })

    it("supports functional updates", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })
      const registry = Registry.make()

      const initialState = atoms.operations.createInitialState({
        name: "John",
        email: "john@test.com",
      })
      registry.set(atoms.stateAtom, Option.some(initialState))

      const setNameAtom = atoms.setValue(atoms.fieldRefs.name)

      registry.mount(setNameAtom)
      registry.set(setNameAtom, (prev: string) => prev.toUpperCase())

      const newState = registry.get(atoms.stateAtom).pipe(Option.getOrThrow)
      expect(newState.values.name).toBe("JOHN")
    })

    it("does not clear stored errors (display logic handles clearing)", () => {
      // Note: errors are intentionally NOT cleared in setValue to avoid race conditions.
      // The display logic in React components handles "clearing" via useMemo based on:
      // 1. Live validation passing
      // 2. Error source (field vs refinement)
      // Actual error clearing happens on the next submit.
      const runtime = Atom.runtime(Layer.empty)
      const form = makeArrayTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })
      const registry = Registry.make()

      const initialState = atoms.operations.createInitialState({
        title: "My List",
        items: [{ name: "Item 1" }],
      })
      registry.set(atoms.stateAtom, Option.some(initialState))

      registry.set(
        atoms.errorsAtom,
        new Map([
          ["items", { message: "Array error", source: "field" as const }],
          ["items[0]", { message: "Item error", source: "field" as const }],
          ["items[0].name", { message: "Name error", source: "field" as const }],
          ["title", { message: "Title error", source: "field" as const }],
        ]),
      )

      const setItemsAtom = atoms.setValue(atoms.fieldRefs.items)

      registry.mount(setItemsAtom)
      registry.set(setItemsAtom, [{ name: "Updated Item" }])

      const errors = registry.get(atoms.errorsAtom)
      expect(errors.has("items")).toBe(true)
      expect(errors.has("items[0]")).toBe(true)
      expect(errors.has("items[0].name")).toBe(true)
      expect(errors.has("title")).toBe(true)
    })
  })

  describe("getFieldAtom", () => {
    it("returns Option.some(value) when initialized", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })
      const registry = Registry.make()

      const initialState = atoms.operations.createInitialState({
        name: "John",
        email: "john@test.com",
      })
      registry.set(atoms.stateAtom, Option.some(initialState))

      const nameAtom = atoms.getFieldAtom(atoms.fieldRefs.name)

      expect(registry.get(nameAtom)).toEqual(Option.some("John"))
    })

    it("updates when field value changes", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })
      const registry = Registry.make()

      let state = atoms.operations.createInitialState({
        name: "John",
        email: "john@test.com",
      })
      registry.set(atoms.stateAtom, Option.some(state))

      const nameAtom = atoms.getFieldAtom(atoms.fieldRefs.name)
      expect(registry.get(nameAtom)).toEqual(Option.some("John"))

      state = atoms.operations.setFieldValue(state, "name", "Jane")
      registry.set(atoms.stateAtom, Option.some(state))

      expect(registry.get(nameAtom)).toEqual(Option.some("Jane"))
    })

    it("returns same atom instance for same field", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })
      const registry = Registry.make()

      registry.set(
        atoms.stateAtom,
        Option.some(atoms.operations.createInitialState({ name: "John", email: "john@test.com" })),
      )

      const nameAtom1 = atoms.getFieldAtom(atoms.fieldRefs.name)
      const nameAtom2 = atoms.getFieldAtom(atoms.fieldRefs.name)

      expect(nameAtom1).toBe(nameAtom2)
    })

    it("returns Option.none() when form is not initialized", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })
      const registry = Registry.make()

      const nameAtom = atoms.getFieldAtom(atoms.fieldRefs.name)

      expect(registry.get(nameAtom)).toEqual(Option.none())
    })

    it("updates from None to Some when form initializes", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })
      const registry = Registry.make()

      const nameAtom = atoms.getFieldAtom(atoms.fieldRefs.name)
      expect(registry.get(nameAtom)).toEqual(Option.none())

      const initialState = atoms.operations.createInitialState({
        name: "John",
        email: "john@test.com",
      })
      registry.set(atoms.stateAtom, Option.some(initialState))

      expect(registry.get(nameAtom)).toEqual(Option.some("John"))
    })
  })

  describe("submitAtom", () => {
    it("does not set lastSubmittedValues on validation failure", async () => {
      const runtime = Atom.runtime(Layer.empty)
      const EmailField = Field.makeField(
        "email",
        Schema.String.pipe(Schema.nonEmptyString({ message: () => "Email is required" })),
      )
      const form = FormBuilder.empty.addField(EmailField)
      const onSubmit = vi.fn()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit })
      const registry = Registry.make()

      const initialState = atoms.operations.createInitialState({ email: "" })
      registry.set(atoms.stateAtom, Option.some(initialState))
      registry.mount(atoms.stateAtom)

      const stateBefore = registry.get(atoms.stateAtom).pipe(Option.getOrThrow)
      expect(Option.isNone(stateBefore.lastSubmittedValues)).toBe(true)

      registry.mount(atoms.submitAtom)
      registry.set(atoms.submitAtom, undefined)

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(onSubmit).not.toHaveBeenCalled()
      const stateAfter = registry.get(atoms.stateAtom).pipe(Option.getOrThrow)
      expect(Option.isNone(stateAfter.lastSubmittedValues)).toBe(true)
    })

    it("sets lastSubmittedValues with encoded and decoded on successful validation", async () => {
      const runtime = Atom.runtime(Layer.empty)
      const EmailField = Field.makeField(
        "email",
        Schema.String.pipe(Schema.nonEmptyString({ message: () => "Email is required" })),
      )
      const form = FormBuilder.empty.addField(EmailField)
      const onSubmit = vi.fn()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit })
      const registry = Registry.make()

      const initialState = atoms.operations.createInitialState({ email: "test@example.com" })
      registry.set(atoms.stateAtom, Option.some(initialState))
      registry.mount(atoms.stateAtom)

      expect(Option.isNone(registry.get(atoms.stateAtom).pipe(Option.getOrThrow).lastSubmittedValues)).toBe(true)

      registry.mount(atoms.submitAtom)
      registry.set(atoms.submitAtom, undefined)

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(onSubmit).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          decoded: { email: "test@example.com" },
          encoded: { email: "test@example.com" },
        }),
      )
      expect(Option.isSome(registry.get(atoms.stateAtom).pipe(Option.getOrThrow).lastSubmittedValues)).toBe(true)
    })

    it("collects all validation errors on submit, not just the first", async () => {
      const runtime = Atom.runtime(Layer.empty)
      const NameField = Field.makeField(
        "name",
        Schema.String.pipe(Schema.nonEmptyString({ message: () => "Name is required" })),
      )
      const EmailField = Field.makeField(
        "email",
        Schema.String.pipe(Schema.nonEmptyString({ message: () => "Email is required" })),
      )
      const AgeField = Field.makeField(
        "age",
        Schema.String.pipe(Schema.nonEmptyString({ message: () => "Age is required" })),
      )
      const form = FormBuilder.empty.addField(NameField).addField(EmailField).addField(AgeField)
      const onSubmit = vi.fn()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit })
      const registry = Registry.make()

      const initialState = atoms.operations.createInitialState({ name: "", email: "", age: "" })
      registry.set(atoms.stateAtom, Option.some(initialState))
      registry.mount(atoms.stateAtom)
      registry.mount(atoms.errorsAtom)
      registry.mount(atoms.submitAtom)
      registry.set(atoms.submitAtom, undefined)

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(onSubmit).not.toHaveBeenCalled()
      const errors = registry.get(atoms.errorsAtom)
      // Should have all 3 errors, not just the first
      expect(errors.size).toBe(3)
      expect(errors.has("name")).toBe(true)
      expect(errors.has("email")).toBe(true)
      expect(errors.has("age")).toBe(true)
    })

    it("preserves previous lastSubmittedValues when subsequent submit fails", async () => {
      const runtime = Atom.runtime(Layer.empty)
      const EmailField = Field.makeField(
        "email",
        Schema.String.pipe(Schema.nonEmptyString({ message: () => "Email is required" })),
      )
      const form = FormBuilder.empty.addField(EmailField)
      const onSubmit = vi.fn()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit })
      const registry = Registry.make()

      let state = atoms.operations.createInitialState({ email: "first@example.com" })
      registry.set(atoms.stateAtom, Option.some(state))
      registry.mount(atoms.stateAtom)
      registry.mount(atoms.submitAtom)
      registry.set(atoms.submitAtom, undefined)

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(onSubmit).toHaveBeenCalledTimes(1)
      state = registry.get(atoms.stateAtom).pipe(Option.getOrThrow)
      expect(Option.isSome(state.lastSubmittedValues)).toBe(true)
      expect(Option.getOrThrow(state.lastSubmittedValues).encoded.email).toBe("first@example.com")
      expect(Option.getOrThrow(state.lastSubmittedValues).decoded.email).toBe("first@example.com")

      state = atoms.operations.setFieldValue(state, "email", "")
      registry.set(atoms.stateAtom, Option.some(state))
      registry.set(atoms.submitAtom, undefined)

      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(onSubmit).toHaveBeenCalledTimes(1)
      const finalState = registry.get(atoms.stateAtom).pipe(Option.getOrThrow)
      expect(Option.isSome(finalState.lastSubmittedValues)).toBe(true)
      expect(Option.getOrThrow(finalState.lastSubmittedValues).encoded.email).toBe("first@example.com")
    })
  })

  describe("rootErrorAtom", () => {
    it("extracts root-level refinement errors from errorsAtom", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })
      const registry = Registry.make()

      const initialState = atoms.operations.createInitialState({
        name: "John",
        email: "john@test.com",
      })
      registry.set(atoms.stateAtom, Option.some(initialState))

      registry.set(
        atoms.errorsAtom,
        new Map([
          ["", { message: "Form-level validation failed", source: "refinement" as const }],
          ["name", { message: "Name error", source: "field" as const }],
        ]),
      )

      const formError = registry.get(atoms.rootErrorAtom)
      expect(Option.isSome(formError)).toBe(true)
      expect(Option.getOrThrow(formError)).toBe("Form-level validation failed")
    })

    it("returns None when no root-level error exists", () => {
      const runtime = Atom.runtime(Layer.empty)
      const form = makeTestForm()
      const atoms = FormAtoms.make({ runtime, formBuilder: form, onSubmit: () => {} })
      const registry = Registry.make()

      const initialState = atoms.operations.createInitialState({
        name: "John",
        email: "john@test.com",
      })
      registry.set(atoms.stateAtom, Option.some(initialState))

      registry.set(
        atoms.errorsAtom,
        new Map([["name", { message: "Name error", source: "field" as const }]]),
      )

      const formError = registry.get(atoms.rootErrorAtom)
      expect(Option.isNone(formError)).toBe(true)
    })
  })
})
