import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Atom from "effect/reactivity/Atom"
import * as Schema from "effect/Schema"
import * as SchemaTransformation from "effect/SchemaTransformation"
import { describe, expectTypeOf, it } from "vitest"
import * as Field from "../src/Field.js"
import * as FormAtoms from "../src/FormAtoms.js"
import * as FormBuilder from "../src/FormBuilder.js"

type FieldsOf<B,> = B extends FormBuilder.FormBuilder<infer F, any> ? F : never

const builder = FormBuilder.empty
  .addField("slug", Schema.String)
  .addField("email", Schema.String)
  .addField("address", Schema.Struct({ city: Schema.String }))
  .addField(Field.makeArrayField("items", Schema.Struct({ name: Schema.String, qty: Schema.Number })))
  .addField(Field.makeArrayField("tags", Schema.String))

type Path = Field.FieldPath<FieldsOf<typeof builder>>

class SlugTaken extends Schema.TaggedError<SlugTaken>()("SlugTaken", {}) {}

class UpstreamValidation extends Schema.TaggedError<UpstreamValidation>()("UpstreamValidation", {
  issues: Schema.Array(Schema.Struct({ field: Schema.Literals(["slug", "email"]), message: Schema.String }))
}) {}

class UpstreamDrifted extends Schema.TaggedError<UpstreamDrifted>()("UpstreamDrifted", {
  issues: Schema.Array(Schema.Struct({ field: Schema.Literals(["slug", "displayName"]), message: Schema.String }))
}) {}

const runtime = Atom.runtime(Layer.empty)
const index: number = 2

describe("FieldPath", () => {
  it("is the root, every top-level key, and struct properties of array items", () => {
    expectTypeOf<Path>().toEqualTypeOf<
      | ""
      | "slug"
      | "email"
      | "address"
      | "items"
      | `items[${number}].name`
      | `items[${number}].qty`
      | "tags"
    >()
  })

  it("rejects paths no field component reads", () => {
    const ok: ReadonlyArray<Path> = ["", "slug", "items", "items[0].name", `items[${index}].qty`, "tags"]
    // @ts-expect-error unknown top-level key
    const typo: Path = "slugg"
    // @ts-expect-error computed path with a misspelled item property
    const computedTypo: Path = `items[${index}].nmae`
    // @ts-expect-error nested struct paths have no field component
    const nested: Path = "address.city"
    // @ts-expect-error primitive array items have no field component
    const primitiveItem: Path = "tags[0]"
    // @ts-expect-error dotted index is not the error key format
    const dotted: Path = "items.0.name"
    void [ok, typo, computedTypo, nested, primitiveItem, dotted]
  })

  it("rejects a plain string until it is narrowed", () => {
    const fromServer: string = "slug"
    // @ts-expect-error string is wider than the form's paths
    const path: Path = fromServer
    void path
  })
})

describe("submitErrors", () => {
  it("receives the error type onSubmit fails with", () => {
    const atoms = FormAtoms.make({
      runtime,
      formBuilder: builder,
      onSubmit: (_: void, { decoded }) => decoded.slug === "taken" ? Effect.fail(new SlugTaken()) : Effect.void,
      submitErrors: (error) => {
        expectTypeOf(error).toEqualTypeOf<SlugTaken>()
        return [{ path: "slug", message: "Taken" }]
      }
    })
    expectTypeOf(atoms.submitAtom).toEqualTypeOf<Atom.AtomResultFn<void, void, SlugTaken | Schema.SchemaError>>()
  })

  it("accepts server fields typed as a subset of the form's paths", () => {
    FormAtoms.make({
      runtime,
      formBuilder: builder,
      onSubmit: () => Effect.fail(new UpstreamValidation({ issues: [] })),
      submitErrors: (error) => [
        ...error.issues.map((issue) => ({ path: issue.field, message: issue.message })),
        { path: `items[${index}].name`, message: "Unknown product" },
        { path: "", message: "Could not save" }
      ]
    })
  })

  it("rejects a misspelled path", () => {
    FormAtoms.make({
      runtime,
      formBuilder: builder,
      onSubmit: () => Effect.fail(new SlugTaken()),
      // @ts-expect-error "slugg" is not a field path
      submitErrors: () => [{ path: "slugg", message: "Taken" }]
    })
  })

  it("rejects server fields that drifted from the form", () => {
    FormAtoms.make({
      runtime,
      formBuilder: builder,
      onSubmit: () => Effect.fail(new UpstreamDrifted({ issues: [] })),
      // @ts-expect-error "displayName" is not a field path
      submitErrors: (error) => error.issues.map((issue) => ({ path: issue.field, message: issue.message }))
    })
  })

  it("requires a path on every entry", () => {
    FormAtoms.make({
      runtime,
      formBuilder: builder,
      onSubmit: () => Effect.fail(new SlugTaken()),
      // @ts-expect-error path is required
      submitErrors: () => [{ message: "Taken" }]
    })
  })

  it("fails to compile when submitErrors comes before a context-sensitive onSubmit", () => {
    FormAtoms.make({
      runtime,
      formBuilder: builder,
      // @ts-expect-error error is never here, so reading its tag fails
      submitErrors: (error) => error._tag === "SlugTaken" ? [{ path: "slug", message: "Taken" }] : [],
      // @ts-expect-error E is fixed to never before onSubmit is checked, so its failure no longer fits
      onSubmit: (_: void, { decoded }) => decoded.slug === "taken" ? Effect.fail(new SlugTaken()) : Effect.void
    })
  })
})

const branded = FormBuilder.empty.addField(
  Field.makeArrayField("items", Schema.Struct({ name: Schema.String }).pipe(Schema.brand("Item")))
)
const suspended = FormBuilder.empty.addField(
  Field.makeArrayField("items", Schema.suspend(() => Schema.Struct({ name: Schema.String })))
)
class OpaqueItem extends Schema.Opaque<OpaqueItem>()(Schema.Struct({ name: Schema.String })) {}
const opaque = FormBuilder.empty.addField(Field.makeArrayField("items", OpaqueItem))

const transformed = FormBuilder.empty.addField(
  Field.makeArrayField(
    "items",
    Schema.Struct({ full_name: Schema.String }).pipe(Schema.decodeTo(
      Schema.Struct({ name: Schema.String }),
      SchemaTransformation.transform({
        decode: (e: { readonly full_name: string }) => ({ name: e.full_name }),
        encode: (d: { readonly name: string }) => ({ full_name: d.name })
      })
    ))
  )
)

describe("FieldPath for wrapped struct items", () => {
  it("includes item sub-field paths the bindings render", () => {
    expectTypeOf<"items[0].name">().toExtend<Field.FieldPath<FieldsOf<typeof branded>>>()
    expectTypeOf<"items[0].name">().toExtend<Field.FieldPath<FieldsOf<typeof suspended>>>()
    expectTypeOf<"items[0].name">().toExtend<Field.FieldPath<FieldsOf<typeof opaque>>>()
  })
  it("matches the sub-fields the runtime path check accepts for a transformed item", () => {
    expectTypeOf<"items[0].name">().toExtend<Field.FieldPath<FieldsOf<typeof transformed>>>()
    // @ts-expect-error the encoded key full_name is not an item sub-field at runtime
    const encodedKey: Field.FieldPath<FieldsOf<typeof transformed>> = "items[0].full_name"
    void encodedKey
  })
})
