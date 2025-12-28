import {
  getNestedValue,
  isPathOrParentDirty,
  schemaPathToFieldPath,
  setNestedValue,
} from "@lucas-barake/effect-form/Path"
import { describe, expect, it } from "vitest"

describe("path utilities", () => {
  describe("schemaPathToFieldPath", () => {
    it("returns empty string for empty path", () => {
      expect(schemaPathToFieldPath([])).toBe("")
    })

    it("returns single segment as-is", () => {
      expect(schemaPathToFieldPath(["name"])).toBe("name")
    })

    it("joins string segments with dots", () => {
      expect(schemaPathToFieldPath(["user", "profile", "name"])).toBe("user.profile.name")
    })

    it("formats number segments with brackets", () => {
      expect(schemaPathToFieldPath(["items", 0])).toBe("items[0]")
      expect(schemaPathToFieldPath(["items", 0, "name"])).toBe("items[0].name")
    })

    it("handles multiple array indices", () => {
      expect(schemaPathToFieldPath(["matrix", 0, 1])).toBe("matrix[0][1]")
      expect(schemaPathToFieldPath(["data", 0, "nested", 2, "value"])).toBe("data[0].nested[2].value")
    })

    it("handles symbol segments by converting to string", () => {
      const sym = Symbol("test")
      expect(schemaPathToFieldPath([sym])).toBe("Symbol(test)")
    })

    it("handles mixed path types", () => {
      expect(schemaPathToFieldPath(["users", 0, "addresses", 1, "city"])).toBe("users[0].addresses[1].city")
    })
  })

  describe("isPathOrParentDirty", () => {
    it("returns true when exact path is dirty", () => {
      const dirtyFields = new Set(["name", "email"])
      expect(isPathOrParentDirty(dirtyFields, "name")).toBe(true)
      expect(isPathOrParentDirty(dirtyFields, "email")).toBe(true)
    })

    it("returns false when path is not dirty", () => {
      const dirtyFields = new Set(["name"])
      expect(isPathOrParentDirty(dirtyFields, "email")).toBe(false)
    })

    it("returns true when parent path with dot is dirty", () => {
      const dirtyFields = new Set(["user"])
      expect(isPathOrParentDirty(dirtyFields, "user.name")).toBe(true)
      expect(isPathOrParentDirty(dirtyFields, "user.profile.email")).toBe(true)
    })

    it("returns true when parent path with bracket is dirty", () => {
      const dirtyFields = new Set(["items"])
      expect(isPathOrParentDirty(dirtyFields, "items[0]")).toBe(true)
      expect(isPathOrParentDirty(dirtyFields, "items[0].name")).toBe(true)
    })

    it("returns true when intermediate parent is dirty", () => {
      const dirtyFields = new Set(["users[0]"])
      expect(isPathOrParentDirty(dirtyFields, "users[0].profile")).toBe(true)
      expect(isPathOrParentDirty(dirtyFields, "users[0].profile.name")).toBe(true)
    })

    it("returns false when only child is dirty", () => {
      const dirtyFields = new Set(["user.name"])
      expect(isPathOrParentDirty(dirtyFields, "user")).toBe(false)
    })

    it("returns false for unrelated paths", () => {
      const dirtyFields = new Set(["users[0].name"])
      expect(isPathOrParentDirty(dirtyFields, "users[1].name")).toBe(false)
      expect(isPathOrParentDirty(dirtyFields, "items[0].name")).toBe(false)
    })

    it("handles empty dirty set", () => {
      const dirtyFields = new Set<string>()
      expect(isPathOrParentDirty(dirtyFields, "anything")).toBe(false)
    })

    it("handles deeply nested paths", () => {
      const dirtyFields = new Set(["a.b"])
      expect(isPathOrParentDirty(dirtyFields, "a.b.c.d.e")).toBe(true)
    })
  })

  describe("getNestedValue", () => {
    it("gets top-level property", () => {
      expect(getNestedValue({ name: "John" }, "name")).toBe("John")
    })

    it("gets nested property with dots", () => {
      expect(getNestedValue({ user: { profile: { name: "John" } } }, "user.profile.name")).toBe("John")
    })

    it("gets array element with bracket notation", () => {
      expect(getNestedValue({ items: ["a", "b", "c"] }, "items[0]")).toBe("a")
      expect(getNestedValue({ items: ["a", "b", "c"] }, "items[2]")).toBe("c")
    })

    it("gets nested property in array element", () => {
      const obj = { items: [{ name: "A" }, { name: "B" }] }
      expect(getNestedValue(obj, "items[0].name")).toBe("A")
      expect(getNestedValue(obj, "items[1].name")).toBe("B")
    })

    it("gets deeply nested value in arrays", () => {
      const obj = {
        users: [
          { addresses: [{ city: "NYC" }, { city: "LA" }] },
          { addresses: [{ city: "SF" }] },
        ],
      }
      expect(getNestedValue(obj, "users[0].addresses[1].city")).toBe("LA")
      expect(getNestedValue(obj, "users[1].addresses[0].city")).toBe("SF")
    })

    it("returns undefined for missing property", () => {
      expect(getNestedValue({ name: "John" }, "email")).toBe(undefined)
    })

    it("returns undefined for missing nested property", () => {
      expect(getNestedValue({ user: {} }, "user.profile.name")).toBe(undefined)
    })

    it("returns undefined for out-of-bounds array index", () => {
      expect(getNestedValue({ items: ["a"] }, "items[5]")).toBe(undefined)
    })

    it("returns undefined when traversing through null", () => {
      expect(getNestedValue({ user: null }, "user.name")).toBe(undefined)
    })

    it("returns undefined when traversing through undefined", () => {
      expect(getNestedValue({ user: undefined }, "user.name")).toBe(undefined)
    })

    it("handles numeric string keys in objects", () => {
      expect(getNestedValue({ "0": "zero" }, "0")).toBe("zero")
    })

    it("returns object itself for empty path", () => {
      const obj = { name: "John" }
      expect(getNestedValue(obj, "")).toBe(obj)
    })

    it("returns undefined when traversing through primitive", () => {
      expect(getNestedValue({ name: "John" }, "name.length")).toBe(undefined)
      expect(getNestedValue({ count: 42 }, "count.value")).toBe(undefined)
      expect(getNestedValue({ active: true }, "active.value")).toBe(undefined)
    })
  })

  describe("setNestedValue", () => {
    it("sets top-level property immutably", () => {
      const original = { name: "John", age: 30 }
      const result = setNestedValue(original, "name", "Jane")

      expect(result).toEqual({ name: "Jane", age: 30 })
      expect(original).toEqual({ name: "John", age: 30 })
      expect(result).not.toBe(original)
    })

    it("sets nested property immutably", () => {
      const original = { user: { profile: { name: "John" } } }
      const result = setNestedValue(original, "user.profile.name", "Jane")

      expect(result).toEqual({ user: { profile: { name: "Jane" } } })
      expect(original).toEqual({ user: { profile: { name: "John" } } })
      expect(result.user).not.toBe(original.user)
      expect(result.user.profile).not.toBe(original.user.profile)
    })

    it("sets array element immutably", () => {
      const original = { items: ["a", "b", "c"] }
      const result = setNestedValue(original, "items[1]", "B")

      expect(result).toEqual({ items: ["a", "B", "c"] })
      expect(original).toEqual({ items: ["a", "b", "c"] })
      expect(result.items).not.toBe(original.items)
    })

    it("sets nested property in array element immutably", () => {
      const original = { items: [{ name: "A" }, { name: "B" }] }
      const result = setNestedValue(original, "items[0].name", "Updated")

      expect(result).toEqual({ items: [{ name: "Updated" }, { name: "B" }] })
      expect(original).toEqual({ items: [{ name: "A" }, { name: "B" }] })
      expect(result.items).not.toBe(original.items)
      expect(result.items[0]).not.toBe(original.items[0])
      expect(result.items[1]).toBe(original.items[1])
    })

    it("sets deeply nested value in arrays immutably", () => {
      const original = {
        users: [
          { addresses: [{ city: "NYC" }, { city: "LA" }] },
          { addresses: [{ city: "SF" }] },
        ],
      }
      const result = setNestedValue(original, "users[0].addresses[1].city", "Boston")

      expect(result.users[0].addresses[1].city).toBe("Boston")
      expect(original.users[0].addresses[1].city).toBe("LA")
      expect(result.users[1]).toBe(original.users[1])
    })

    it("preserves other properties when setting nested value", () => {
      const original = { user: { name: "John", age: 30 } }
      const result = setNestedValue(original, "user.name", "Jane")

      expect(result).toEqual({ user: { name: "Jane", age: 30 } })
    })

    it("handles setting to null or undefined", () => {
      const original = { name: "John" }
      expect(setNestedValue(original, "name", null)).toEqual({ name: null })
      expect(setNestedValue(original, "name", undefined)).toEqual({ name: undefined })
    })

    it("handles setting object values", () => {
      const original = { user: { profile: {} } }
      const result = setNestedValue(original, "user.profile", { name: "John", age: 30 })

      expect(result).toEqual({ user: { profile: { name: "John", age: 30 } } })
    })

    it("handles setting array values", () => {
      const original = { items: [] }
      const result = setNestedValue(original, "items", [1, 2, 3])

      expect(result).toEqual({ items: [1, 2, 3] })
    })

    it("returns value as new root for empty path", () => {
      const original = { name: "John" }
      const newValue = { name: "Jane", age: 30 }
      const result = setNestedValue(original, "", newValue)

      expect(result).toBe(newValue)
    })
  })
})
