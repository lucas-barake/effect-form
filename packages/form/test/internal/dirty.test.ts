import { describe, expect, it } from "vitest";
import { recalculateDirtyFieldsForArray, recalculateDirtySubtree } from "../../src/internal/dirty.js";

describe("dirty tracking utilities", () => {
  describe("recalculateDirtyFieldsForArray", () => {
    it("marks items as dirty when they differ from initial", () => {
      const dirtyFields = new Set<string>();
      const initialValues = { items: [{ name: "A" }, { name: "B" }] };
      const newItems = [{ name: "A-modified" }, { name: "B" }];

      const result = recalculateDirtyFieldsForArray(dirtyFields, initialValues, "items", newItems);

      expect(result.has("items[0]")).toBe(true);
      expect(result.has("items[1]")).toBe(false);
    });

    it("marks array as dirty when length changes (items added)", () => {
      const dirtyFields = new Set<string>();
      const initialValues = { items: [{ name: "A" }] };
      const newItems = [{ name: "A" }, { name: "B" }];

      const result = recalculateDirtyFieldsForArray(dirtyFields, initialValues, "items", newItems);

      expect(result.has("items")).toBe(true);
      expect(result.has("items[1]")).toBe(true);
    });

    it("marks array as dirty when length changes (items removed)", () => {
      const dirtyFields = new Set<string>();
      const initialValues = { items: [{ name: "A" }, { name: "B" }] };
      const newItems = [{ name: "A" }];

      const result = recalculateDirtyFieldsForArray(dirtyFields, initialValues, "items", newItems);

      expect(result.has("items")).toBe(true);
    });

    it("removes array from dirty set when length matches initial", () => {
      const dirtyFields = new Set(["items"]);
      const initialValues = { items: [{ name: "A" }, { name: "B" }] };
      const newItems = [{ name: "A" }, { name: "B" }];

      const result = recalculateDirtyFieldsForArray(dirtyFields, initialValues, "items", newItems);

      expect(result.has("items")).toBe(false);
    });

    it("clears old array-related dirty paths before recalculating", () => {
      const dirtyFields = new Set(["items[0]", "items[1].name", "items[2]", "other"]);
      const initialValues = { items: [{ name: "A" }] };
      const newItems = [{ name: "A" }];

      const result = recalculateDirtyFieldsForArray(dirtyFields, initialValues, "items", newItems);

      expect(result.has("items[0]")).toBe(false);
      expect(result.has("items[1].name")).toBe(false);
      expect(result.has("items[2]")).toBe(false);
      expect(result.has("other")).toBe(true);
    });

    it("handles empty initial array", () => {
      const dirtyFields = new Set<string>();
      const initialValues = { items: [] };
      const newItems = [{ name: "A" }];

      const result = recalculateDirtyFieldsForArray(dirtyFields, initialValues, "items", newItems);

      expect(result.has("items")).toBe(true);
      expect(result.has("items[0]")).toBe(true);
    });

    it("handles empty new array", () => {
      const dirtyFields = new Set<string>();
      const initialValues = { items: [{ name: "A" }] };
      const newItems: Array<{ name: string; }> = [];

      const result = recalculateDirtyFieldsForArray(dirtyFields, initialValues, "items", newItems);

      expect(result.has("items")).toBe(true);
    });

    it("handles missing initial array (defaults to empty)", () => {
      const dirtyFields = new Set<string>();
      const initialValues = {};
      const newItems = [{ name: "A" }];

      const result = recalculateDirtyFieldsForArray(dirtyFields, initialValues, "items", newItems);

      expect(result.has("items")).toBe(true);
      expect(result.has("items[0]")).toBe(true);
    });

    it("preserves unrelated dirty fields", () => {
      const dirtyFields = new Set(["name", "email", "user.profile"]);
      const initialValues = { items: [{ name: "A" }] };
      const newItems = [{ name: "A-modified" }];

      const result = recalculateDirtyFieldsForArray(dirtyFields, initialValues, "items", newItems);

      expect(result.has("name")).toBe(true);
      expect(result.has("email")).toBe(true);
      expect(result.has("user.profile")).toBe(true);
    });

    it("handles nested array paths", () => {
      const dirtyFields = new Set<string>();
      const initialValues = { user: { addresses: [{ city: "NYC" }] } };
      const newItems = [{ city: "LA" }];

      const result = recalculateDirtyFieldsForArray(dirtyFields, initialValues, "user.addresses", newItems);

      expect(result.has("user.addresses[0]")).toBe(true);
    });

    it("uses structural equality for comparison", () => {
      const dirtyFields = new Set<string>();
      const initialValues = { items: [{ nested: { value: 1 } }] };
      const newItems = [{ nested: { value: 1 } }];

      const result = recalculateDirtyFieldsForArray(dirtyFields, initialValues, "items", newItems);

      expect(result.has("items[0]")).toBe(false);
    });
  });

  describe("recalculateDirtySubtree", () => {
    it("marks leaf fields as dirty when values differ", () => {
      const currentDirty = new Set<string>();
      const initial = { name: "John", age: 30 };
      const values = { name: "Jane", age: 30 };

      const result = recalculateDirtySubtree(currentDirty, initial, values);

      expect(result.has("name")).toBe(true);
      expect(result.has("age")).toBe(false);
    });

    it("clears all dirty fields when recalculating from root", () => {
      const currentDirty = new Set(["name", "user.profile", "items[0]"]);
      const initial = { name: "John" };
      const values = { name: "John" };

      const result = recalculateDirtySubtree(currentDirty, initial, values);

      expect(result.size).toBe(0);
    });

    it("only clears subtree when rootPath is specified", () => {
      const currentDirty = new Set(["name", "user.profile", "user.age"]);
      const initial = { name: "Original", user: { profile: "A", age: 25 } };
      const values = { name: "Changed", user: { profile: "A", age: 25 } };

      const result = recalculateDirtySubtree(currentDirty, initial, values, "user");

      expect(result.has("name")).toBe(true);
      expect(result.has("user.profile")).toBe(false);
      expect(result.has("user.age")).toBe(false);
    });

    it("handles nested objects", () => {
      const currentDirty = new Set<string>();
      const initial = { user: { profile: { name: "John", email: "john@test.com" } } };
      const values = { user: { profile: { name: "Jane", email: "john@test.com" } } };

      const result = recalculateDirtySubtree(currentDirty, initial, values);

      expect(result.has("user.profile.name")).toBe(true);
      expect(result.has("user.profile.email")).toBe(false);
    });

    it("handles arrays", () => {
      const currentDirty = new Set<string>();
      const initial = { items: ["a", "b", "c"] };
      const values = { items: ["a", "B", "c"] };

      const result = recalculateDirtySubtree(currentDirty, initial, values);

      expect(result.has("items[0]")).toBe(false);
      expect(result.has("items[1]")).toBe(true);
      expect(result.has("items[2]")).toBe(false);
    });

    it("handles arrays of objects", () => {
      const currentDirty = new Set<string>();
      const initial = { items: [{ name: "A" }, { name: "B" }] };
      const values = { items: [{ name: "A" }, { name: "B-modified" }] };

      const result = recalculateDirtySubtree(currentDirty, initial, values);

      expect(result.has("items[0].name")).toBe(false);
      expect(result.has("items[1].name")).toBe(true);
    });

    it("handles added array items", () => {
      const currentDirty = new Set<string>();
      const initial = { items: [{ name: "A" }] };
      const values = { items: [{ name: "A" }, { name: "B" }] };

      const result = recalculateDirtySubtree(currentDirty, initial, values);

      expect(result.has("items[0].name")).toBe(false);
      expect(result.has("items[1].name")).toBe(true);
    });

    it("handles removed array items", () => {
      const currentDirty = new Set<string>();
      const initial = { items: [{ name: "A" }, { name: "B" }] };
      const values = { items: [{ name: "A" }] };

      const result = recalculateDirtySubtree(currentDirty, initial, values);

      expect(result.has("items[0].name")).toBe(false);
      // When item is removed, the index itself is marked dirty (undefined vs object comparison)
      expect(result.has("items[1]")).toBe(true);
    });

    it("handles added object keys", () => {
      const currentDirty = new Set<string>();
      const initial = { name: "John" };
      const values = { name: "John", email: "john@test.com" };

      const result = recalculateDirtySubtree(currentDirty, initial, values);

      expect(result.has("name")).toBe(false);
      expect(result.has("email")).toBe(true);
    });

    it("handles removed object keys", () => {
      const currentDirty = new Set<string>();
      const initial = { name: "John", email: "john@test.com" };
      const values = { name: "John" };

      const result = recalculateDirtySubtree(currentDirty, initial, values);

      expect(result.has("name")).toBe(false);
      expect(result.has("email")).toBe(true);
    });

    it("handles null values", () => {
      const currentDirty = new Set<string>();
      const initial = { name: "John" };
      const values = { name: null };

      const result = recalculateDirtySubtree(currentDirty, initial, values);

      expect(result.has("name")).toBe(true);
    });

    it("handles undefined values", () => {
      const currentDirty = new Set<string>();
      const initial = { name: "John" };
      const values = { name: undefined };

      const result = recalculateDirtySubtree(currentDirty, initial, values);

      expect(result.has("name")).toBe(true);
    });

    it("uses structural equality for comparison", () => {
      const currentDirty = new Set<string>();
      const initial = { data: { nested: { value: 1 } } };
      const values = { data: { nested: { value: 1 } } };

      const result = recalculateDirtySubtree(currentDirty, initial, values);

      expect(result.size).toBe(0);
    });

    it("recalculates only specified subtree path", () => {
      const currentDirty = new Set(["items[0].name", "items[1].name", "other"]);
      const initial = {
        items: [{ name: "A" }, { name: "B" }],
        other: "value",
      };
      const values = {
        items: [{ name: "A-modified" }, { name: "B" }],
        other: "changed",
      };

      const result = recalculateDirtySubtree(currentDirty, initial, values, "items");

      expect(result.has("items[0].name")).toBe(true);
      expect(result.has("items[1].name")).toBe(false);
      expect(result.has("other")).toBe(true);
    });

    it("clears paths with bracket notation when recalculating subtree", () => {
      const currentDirty = new Set(["items", "items[0]", "items[0].name", "name"]);
      const initial = { items: [{ name: "A" }], name: "test" };
      const values = { items: [{ name: "A" }], name: "changed" };

      const result = recalculateDirtySubtree(currentDirty, initial, values, "items");

      expect(result.has("items")).toBe(false);
      expect(result.has("items[0]")).toBe(false);
      expect(result.has("items[0].name")).toBe(false);
      expect(result.has("name")).toBe(true);
    });
  });
});
