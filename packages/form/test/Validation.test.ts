import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { describe, expect, it } from "vitest"
import { extractFirstError, routeErrors } from "../src/Validation.js"

describe("Validation", () => {
  describe("extractFirstError", () => {
    it("returns Some with first error message for invalid input", () => {
      const schema = Schema.Struct({
        name: Schema.String.pipe(Schema.minLength(3, { message: () => "Name too short" })),
      })
      const result = Schema.decodeUnknownEither(schema)({ name: "AB" })

      if (result._tag === "Right") {
        throw new Error("Expected Left")
      }

      const error = extractFirstError(result.left)
      expect(error._tag).toBe("Some")
      if (error._tag === "Some") {
        expect(error.value).toBe("Name too short")
      }
    })

    it("returns first error when multiple errors exist", () => {
      const schema = Schema.Struct({
        name: Schema.String.pipe(Schema.minLength(3, { message: () => "Name too short" })),
        email: Schema.String.pipe(Schema.pattern(/@/, { message: () => "Invalid email" })),
      })
      const result = Schema.decodeUnknownEither(schema)({ name: "AB", email: "invalid" })

      if (result._tag === "Right") {
        throw new Error("Expected Left")
      }

      const error = extractFirstError(result.left)
      expect(error._tag).toBe("Some")
    })

    it("handles nested field errors", () => {
      const schema = Schema.Struct({
        user: Schema.Struct({
          email: Schema.String.pipe(Schema.pattern(/@/, { message: () => "Invalid email format" })),
        }),
      })
      const result = Schema.decodeUnknownEither(schema)({ user: { email: "invalid" } })

      if (result._tag === "Right") {
        throw new Error("Expected Left")
      }

      const error = extractFirstError(result.left)
      expect(error._tag).toBe("Some")
      if (error._tag === "Some") {
        expect(error.value).toBe("Invalid email format")
      }
    })

    it("handles array field errors", () => {
      const schema = Schema.Struct({
        items: Schema.Array(
          Schema.Struct({
            name: Schema.String.pipe(Schema.minLength(1, { message: () => "Name required" })),
          }),
        ),
      })
      const result = Schema.decodeUnknownEither(schema)({ items: [{ name: "" }] })

      if (result._tag === "Right") {
        throw new Error("Expected Left")
      }

      const error = extractFirstError(result.left)
      expect(error._tag).toBe("Some")
      if (error._tag === "Some") {
        expect(error.value).toBe("Name required")
      }
    })
  })

  describe("routeErrors", () => {
    it("routes single error to field path", () => {
      const schema = Schema.Struct({
        email: Schema.String.pipe(Schema.pattern(/@/, { message: () => "Invalid email" })),
      })
      const result = Schema.decodeUnknownEither(schema)({ email: "invalid" })

      if (result._tag === "Right") {
        throw new Error("Expected Left")
      }

      const errors = routeErrors(result.left)
      expect(errors.get("email")).toBe("Invalid email")
      expect(errors.size).toBe(1)
    })

    it("routes first error when schema short-circuits", () => {
      // Schema short-circuits on first error, so only one error is reported
      const schema = Schema.Struct({
        name: Schema.Number,
        email: Schema.Number,
      })
      const result = Schema.decodeUnknownEither(schema)({ name: "not-a-number", email: "also-not" })

      if (result._tag === "Right") {
        throw new Error("Expected Left")
      }

      const errors = routeErrors(result.left)
      // Schema short-circuits, so only the first field error is captured
      expect(errors.size).toBe(1)
      expect(errors.has("name")).toBe(true)
    })

    it("routes nested field errors with dot notation", () => {
      const schema = Schema.Struct({
        user: Schema.Struct({
          profile: Schema.Struct({
            email: Schema.String.pipe(Schema.pattern(/@/, { message: () => "Invalid email" })),
          }),
        }),
      })
      const result = Schema.decodeUnknownEither(schema)({ user: { profile: { email: "invalid" } } })

      if (result._tag === "Right") {
        throw new Error("Expected Left")
      }

      const errors = routeErrors(result.left)
      expect(errors.get("user.profile.email")).toBe("Invalid email")
    })

    it("routes array field errors with bracket notation", () => {
      const schema = Schema.Struct({
        items: Schema.Array(
          Schema.Struct({
            name: Schema.String.pipe(Schema.minLength(1, { message: () => "Name required" })),
          }),
        ),
      })
      const result = Schema.decodeUnknownEither(schema)({ items: [{ name: "" }] })

      if (result._tag === "Right") {
        throw new Error("Expected Left")
      }

      const errors = routeErrors(result.left)
      expect(errors.get("items[0].name")).toBe("Name required")
    })

    it("routes first array item error when schema short-circuits", () => {
      // Schema short-circuits on first error within arrays too
      const schema = Schema.Struct({
        items: Schema.Array(
          Schema.Struct({
            name: Schema.Number,
          }),
        ),
      })
      const result = Schema.decodeUnknownEither(schema)({
        items: [{ name: "invalid" }, { name: 123 }, { name: "also-invalid" }],
      })

      if (result._tag === "Right") {
        throw new Error("Expected Left")
      }

      const errors = routeErrors(result.left)
      // Schema short-circuits, so only the first array item error is captured
      expect(errors.size).toBe(1)
      expect(errors.has("items[0].name")).toBe(true)
    })

    it("keeps first error when multiple errors exist for same path", () => {
      const schema = Schema.Struct({
        password: Schema.String.pipe(
          Schema.minLength(8, { message: () => "Password too short" }),
          Schema.pattern(/[A-Z]/, { message: () => "Must contain uppercase" }),
        ),
      })
      const result = Schema.decodeUnknownEither(schema)({ password: "abc" })

      if (result._tag === "Right") {
        throw new Error("Expected Left")
      }

      const errors = routeErrors(result.left)
      expect(errors.size).toBe(1)
      expect(errors.get("password")).toBe("Password too short")
    })

    it("handles deeply nested array errors", () => {
      const schema = Schema.Struct({
        users: Schema.Array(
          Schema.Struct({
            addresses: Schema.Array(
              Schema.Struct({
                city: Schema.String.pipe(Schema.minLength(2, { message: () => "City too short" })),
              }),
            ),
          }),
        ),
      })
      const result = Schema.decodeUnknownEither(schema)({
        users: [{ addresses: [{ city: "X" }] }],
      })

      if (result._tag === "Right") {
        throw new Error("Expected Left")
      }

      const errors = routeErrors(result.left)
      expect(errors.get("users[0].addresses[0].city")).toBe("City too short")
    })

    it("handles refinement errors with path", async () => {
      const schema = Schema.Struct({
        password: Schema.String,
        confirmPassword: Schema.String,
      }).pipe(
        Schema.filter((values) => {
          if (values.password !== values.confirmPassword) {
            return {
              path: ["confirmPassword"],
              message: "Passwords must match",
            }
          }
        }),
      )

      const result = await Effect.runPromise(
        Schema.decodeUnknown(schema)({ password: "abc", confirmPassword: "xyz" }).pipe(
          Effect.either,
        ),
      )

      if (result._tag === "Right") {
        throw new Error("Expected Left")
      }

      const errors = routeErrors(result.left)
      expect(errors.get("confirmPassword")).toBe("Passwords must match")
    })

    it("handles type errors at field level", () => {
      const schema = Schema.Struct({
        age: Schema.Number,
      })
      const result = Schema.decodeUnknownEither(schema)({ age: "not a number" })

      if (result._tag === "Right") {
        throw new Error("Expected Left")
      }

      const errors = routeErrors(result.left)
      expect(errors.has("age")).toBe(true)
    })
  })
})
