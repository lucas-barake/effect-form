import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as SchemaGetter from "effect/SchemaGetter"
import { describe, expect, it } from "vitest"
import { extractFirstError, routeErrors, routeErrorsWithSource } from "../src/Validation.js"

const getSchemaError = (exit: Exit.Exit<unknown, Schema.SchemaError>): Schema.SchemaError => {
  if (Exit.isSuccess(exit)) throw new Error("Expected failure")
  return Option.getOrThrow(Cause.findErrorOption(exit.cause))
}

describe("Validation", () => {
  describe("extractFirstError", () => {
    it("returns Some with first error message for invalid input", () => {
      const schema = Schema.Struct({
        name: Schema.String.pipe(Schema.check(Schema.isMinLength(3, { message: "Name too short" })))
      })
      const exit = Schema.decodeUnknownExit(schema)({ name: "AB" })
      const error = extractFirstError(getSchemaError(exit))
      expect(error._tag).toBe("Some")
      if (error._tag === "Some") {
        expect(error.value).toBe("Name too short")
      }
    })

    it("returns first error when multiple errors exist", () => {
      const schema = Schema.Struct({
        name: Schema.String.pipe(Schema.check(Schema.isMinLength(3, { message: "Name too short" }))),
        email: Schema.String.pipe(Schema.check(Schema.isPattern(/@/, { message: "Invalid email" })))
      })
      const exit = Schema.decodeUnknownExit(schema)({ name: "AB", email: "invalid" })
      const error = extractFirstError(getSchemaError(exit))
      expect(error._tag).toBe("Some")
    })

    it("handles nested field errors", () => {
      const schema = Schema.Struct({
        user: Schema.Struct({
          email: Schema.String.pipe(Schema.check(Schema.isPattern(/@/, { message: "Invalid email format" })))
        })
      })
      const exit = Schema.decodeUnknownExit(schema)({ user: { email: "invalid" } })
      const error = extractFirstError(getSchemaError(exit))
      expect(error._tag).toBe("Some")
      if (error._tag === "Some") {
        expect(error.value).toBe("Invalid email format")
      }
    })

    it("handles array field errors", () => {
      const schema = Schema.Struct({
        items: Schema.Array(
          Schema.Struct({
            name: Schema.String.pipe(Schema.check(Schema.isMinLength(1, { message: "Name required" })))
          })
        )
      })
      const exit = Schema.decodeUnknownExit(schema)({ items: [{ name: "" }] })
      const error = extractFirstError(getSchemaError(exit))
      expect(error._tag).toBe("Some")
      if (error._tag === "Some") {
        expect(error.value).toBe("Name required")
      }
    })
  })

  describe("routeErrors", () => {
    it("routes single error to field path", () => {
      const schema = Schema.Struct({
        email: Schema.String.pipe(Schema.check(Schema.isPattern(/@/, { message: "Invalid email" })))
      })
      const exit = Schema.decodeUnknownExit(schema)({ email: "invalid" })
      const errors = routeErrors(getSchemaError(exit))
      expect(errors.get("email")).toBe("Invalid email")
      expect(errors.size).toBe(1)
    })

    it("routes first error when schema short-circuits", () => {
      const schema = Schema.Struct({
        name: Schema.Number,
        email: Schema.Number
      })
      const exit = Schema.decodeUnknownExit(schema)({ name: "not-a-number", email: "also-not" })
      const errors = routeErrors(getSchemaError(exit))
      expect(errors.size).toBe(1)
      expect(errors.has("name")).toBe(true)
    })

    it("routes nested field errors with dot notation", () => {
      const schema = Schema.Struct({
        user: Schema.Struct({
          profile: Schema.Struct({
            email: Schema.String.pipe(Schema.check(Schema.isPattern(/@/, { message: "Invalid email" })))
          })
        })
      })
      const exit = Schema.decodeUnknownExit(schema)({ user: { profile: { email: "invalid" } } })
      const errors = routeErrors(getSchemaError(exit))
      expect(errors.get("user.profile.email")).toBe("Invalid email")
    })

    it("routes array field errors with bracket notation", () => {
      const schema = Schema.Struct({
        items: Schema.Array(
          Schema.Struct({
            name: Schema.String.pipe(Schema.check(Schema.isMinLength(1, { message: "Name required" })))
          })
        )
      })
      const exit = Schema.decodeUnknownExit(schema)({ items: [{ name: "" }] })
      const errors = routeErrors(getSchemaError(exit))
      expect(errors.get("items[0].name")).toBe("Name required")
    })

    it("routes first array item error when schema short-circuits", () => {
      const schema = Schema.Struct({
        items: Schema.Array(
          Schema.Struct({
            name: Schema.Number
          })
        )
      })
      const exit = Schema.decodeUnknownExit(schema)({
        items: [{ name: "invalid" }, { name: 123 }, { name: "also-invalid" }]
      })
      const errors = routeErrors(getSchemaError(exit))
      expect(errors.size).toBe(1)
      expect(errors.has("items[0].name")).toBe(true)
    })

    it("keeps first error when multiple errors exist for same path", () => {
      const schema = Schema.Struct({
        password: Schema.String.pipe(
          Schema.check(
            Schema.isMinLength(8, { message: "Password too short" }),
            Schema.isPattern(/[A-Z]/, { message: "Must contain uppercase" })
          )
        )
      })
      const exit = Schema.decodeUnknownExit(schema)({ password: "abc" })
      const errors = routeErrors(getSchemaError(exit))
      expect(errors.size).toBe(1)
      expect(errors.get("password")).toBe("Password too short")
    })

    it("handles deeply nested array errors", () => {
      const schema = Schema.Struct({
        users: Schema.Array(
          Schema.Struct({
            addresses: Schema.Array(
              Schema.Struct({
                city: Schema.String.pipe(Schema.check(Schema.isMinLength(2, { message: "City too short" })))
              })
            )
          })
        )
      })
      const exit = Schema.decodeUnknownExit(schema)({
        users: [{ addresses: [{ city: "X" }] }]
      })
      const errors = routeErrors(getSchemaError(exit))
      expect(errors.get("users[0].addresses[0].city")).toBe("City too short")
    })

    it("handles refinement errors with path", async () => {
      const schema = Schema.Struct({
        password: Schema.String,
        confirmPassword: Schema.String
      }).pipe(
        Schema.check(Schema.makeFilter((values) => {
          if (values.password !== values.confirmPassword) {
            return {
              path: ["confirmPassword"],
              message: "Passwords must match"
            }
          }
        }))
      )

      const result = await Effect.runPromise(
        Schema.decodeUnknownEffect(schema)({ password: "abc", confirmPassword: "xyz" }).pipe(
          Effect.exit
        )
      )

      const errors = routeErrors(getSchemaError(result))
      expect(errors.get("confirmPassword")).toBe("Passwords must match")
    })

    it("handles type errors at field level", () => {
      const schema = Schema.Struct({
        age: Schema.Number
      })
      const exit = Schema.decodeUnknownExit(schema)({ age: "not a number" })
      const errors = routeErrors(getSchemaError(exit))
      expect(errors.has("age")).toBe(true)
    })
  })

  describe("routeErrorsWithSource", () => {
    it("tags field schema errors as 'field'", () => {
      const schema = Schema.Struct({
        password: Schema.String.pipe(Schema.check(Schema.isMinLength(8, { message: "Too short" })))
      })
      const exit = Schema.decodeUnknownExit(schema)({ password: "abc" })
      const errors = routeErrorsWithSource(getSchemaError(exit))
      const entry = errors.get("password")
      expect(entry).toBeDefined()
      expect(entry?.source).toBe("field")
      expect(entry?.message).toBe("Too short")
    })

    it("tags Struct refinement errors as 'refinement'", async () => {
      const schema = Schema.Struct({
        password: Schema.String,
        confirm: Schema.String
      }).pipe(
        Schema.check(Schema.makeFilter((values) => {
          if (values.password !== values.confirm) {
            return { path: ["confirm"], message: "Must match" }
          }
        }))
      )

      const result = await Effect.runPromise(
        Schema.decodeUnknownEffect(schema)({ password: "abc", confirm: "xyz" }).pipe(Effect.exit)
      )

      const errors = routeErrorsWithSource(getSchemaError(result))
      const entry = errors.get("confirm")
      expect(entry).toBeDefined()
      expect(entry?.source).toBe("refinement")
      expect(entry?.message).toBe("Must match")
    })

    it("tags Union refinement errors as 'refinement'", async () => {
      const OptionA = Schema.Struct({ type: Schema.Literal("a"), value: Schema.String })
      const OptionB = Schema.Struct({ type: Schema.Literal("b"), count: Schema.Number })
      const schema = Schema.Union([OptionA, OptionB]).pipe(
        Schema.check(
          Schema.makeFilter(
            (
              union: { readonly type: "a"; readonly value: string } | { readonly type: "b"; readonly count: number }
            ) => {
              if (union.type === "a" && union.value.length < 3) {
                return { path: ["value"], message: "Value too short" }
              }
            }
          )
        )
      )

      const result = await Effect.runPromise(
        Schema.decodeUnknownEffect(schema)({ type: "a", value: "ab" }).pipe(Effect.exit)
      )

      const errors = routeErrorsWithSource(getSchemaError(result))
      const entry = errors.get("value")
      expect(entry).toBeDefined()
      expect(entry?.source).toBe("refinement")
    })

    it("tags Class refinement errors as 'refinement'", async () => {
      class PasswordForm extends Schema.Class<PasswordForm>("PasswordForm")({
        password: Schema.String,
        confirm: Schema.String
      }) {}

      const schema = PasswordForm.pipe(
        Schema.check(Schema.makeFilter((values) => {
          if (values.password !== values.confirm) {
            return { path: ["confirm"], message: "Passwords must match" }
          }
        }))
      )

      const result = await Effect.runPromise(
        Schema.decodeUnknownEffect(schema)({ password: "abc", confirm: "xyz" }).pipe(Effect.exit)
      )

      const errors = routeErrorsWithSource(getSchemaError(result))
      const entry = errors.get("confirm")
      expect(entry).toBeDefined()
      expect(entry?.source).toBe("refinement")
      expect(entry?.message).toBe("Passwords must match")
    })

    it("tags effectful refinement errors as 'refinement'", async () => {
      const schema = Schema.Struct({
        username: Schema.String.pipe(Schema.check(Schema.isMinLength(3)))
      }).pipe(
        Schema.decode({
          decode: SchemaGetter.checkEffect((values) =>
            Effect.sync(() => {
              const reserved = ["admin", "root", "taken"]
              if (reserved.includes(values.username.toLowerCase())) {
                return { path: ["username"], message: "Username is reserved" }
              }
            })
          ),
          encode: SchemaGetter.passthrough()
        })
      )

      const result = await Effect.runPromise(
        Schema.decodeUnknownEffect(schema)({ username: "admin" }).pipe(Effect.exit)
      )

      const errors = routeErrorsWithSource(getSchemaError(result))
      const entry = errors.get("username")
      expect(entry).toBeDefined()
      expect(entry?.source).toBe("refinement")
      expect(entry?.message).toBe("Username is reserved")
    })

    it("routes root-level refinement errors to empty string key", async () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.String
      }).pipe(
        Schema.check(Schema.makeFilter((values) => {
          if (values.a === values.b) {
            return "Values must be different"
          }
        }))
      )

      const result = await Effect.runPromise(
        Schema.decodeUnknownEffect(schema)({ a: "same", b: "same" }).pipe(Effect.exit)
      )

      const errors = routeErrorsWithSource(getSchemaError(result))
      const entry = errors.get("")
      expect(entry).toBeDefined()
      expect(entry?.source).toBe("refinement")
      expect(entry?.message).toBe("Values must be different")
    })

    it("tags nested struct filter errors as 'field' (not top-level refinement)", async () => {
      const AddressSchema = Schema.Struct({
        street: Schema.String,
        city: Schema.String
      }).pipe(
        Schema.check(Schema.makeFilter((address) => {
          if (address.street === "" && address.city === "") {
            return "At least one address field is required"
          }
        }))
      )

      const schema = Schema.Struct({
        name: Schema.String,
        address: AddressSchema
      })

      const result = await Effect.runPromise(
        Schema.decodeUnknownEffect(schema)({ name: "John", address: { street: "", city: "" } }).pipe(
          Effect.exit
        )
      )

      const errors = routeErrorsWithSource(getSchemaError(result))
      const entry = errors.get("address")
      expect(entry).toBeDefined()
      expect(entry?.source).toBe("field")
      expect(entry?.message).toBe("At least one address field is required")
    })

    it("tags nested struct effectful filter errors as 'field' (not top-level refinement)", async () => {
      const AddressSchema = Schema.Struct({
        street: Schema.String,
        city: Schema.String
      }).pipe(
        Schema.decode({
          decode: SchemaGetter.checkEffect((address) =>
            Effect.sync(() => {
              if (address.street === "" && address.city === "") {
                return "Address validation failed"
              }
            })
          ),
          encode: SchemaGetter.passthrough()
        })
      )

      const schema = Schema.Struct({
        name: Schema.String,
        address: AddressSchema
      })

      const result = await Effect.runPromise(
        Schema.decodeUnknownEffect(schema)({ name: "John", address: { street: "", city: "" } }).pipe(
          Effect.exit
        )
      )

      const errors = routeErrorsWithSource(getSchemaError(result))
      const entry = errors.get("address")
      expect(entry).toBeDefined()
      expect(entry?.source).toBe("field")
      expect(entry?.message).toBe("Address validation failed")
    })

    it("prefers refinement errors when field and refinement target the same path", async () => {
      const schema = Schema.Struct({ age: Schema.Number }).pipe(
        Schema.check(Schema.makeFilter(() => ({ path: ["age"], message: "Refinement error" })))
      )

      const result = await Effect.runPromise(
        Schema.decodeUnknownEffect(schema)({ age: 5 }).pipe(Effect.exit)
      )

      const errors = routeErrorsWithSource(getSchemaError(result))
      const entry = errors.get("age")

      expect(entry).toBeDefined()
      expect(entry?.source).toBe("refinement")
      expect(entry?.message).toBe("Refinement error")
    })
  })
})
