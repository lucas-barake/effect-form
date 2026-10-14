import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import * as Schema from "effect/Schema"
import * as SchemaGetter from "effect/SchemaGetter"
import { describe, expect, it, vi } from "vitest"
import * as Field from "../src/Field.js"
import * as FormAtoms from "../src/FormAtoms.js"
import * as FormBuilder from "../src/FormBuilder.js"

class SignupRejected extends Schema.TaggedError<SignupRejected>()("SignupRejected", {
  errors: Schema.Array(Schema.Struct({ path: Schema.String, message: Schema.String }))
}) {}

const ItemSchema = Schema.Struct({ name: Schema.String, qty: Schema.Number })

const builder = FormBuilder.empty
  .addField("slug", Schema.String.pipe(Schema.check(Schema.isMinLength(3, { message: "Too short" }))))
  .addField("email", Schema.String)
  .addField("address", Schema.Struct({ city: Schema.String }))
  .addField(Field.makeArrayField("items", ItemSchema))

type Fields = typeof builder extends FormBuilder.FormBuilder<infer F, any> ? F : never

const defaults: Field.EncodedFromFields<Fields> = {
  slug: "taken",
  email: "a@b.io",
  address: { city: "Lima" },
  items: [{ name: "Pen", qty: 1 }, { name: "Ink", qty: 2 }]
}

const reject = (errors: ReadonlyArray<{ readonly path: string; readonly message: string }>) =>
  new SignupRejected({ errors })

const toSubmitErrors = (error: SignupRejected) =>
  error.errors.map(({ message, path }) => ({ path: path as Field.FieldPath<Fields>, message }))

const makeForm = (options: {
  readonly onSubmit: FormAtoms.FormAtomsConfig<Fields, never, void, SignupRejected>["onSubmit"]
  readonly submitErrors?: (error: SignupRejected) => ReadonlyArray<FormAtoms.SubmitError<Fields>>
  readonly mode?: FormAtoms.FormAtomsConfig<Fields, never, void, SignupRejected>["mode"]
  readonly formBuilder?: FormBuilder.FormBuilder<Fields, never>
}) => {
  const atoms = FormAtoms.make({
    runtime: Atom.runtime(Layer.empty),
    formBuilder: options.formBuilder ?? builder,
    ...(options.mode ? { mode: options.mode } : {}),
    onSubmit: options.onSubmit,
    submitErrors: options.submitErrors ?? toSubmitErrors
  })
  const registry = AtomRegistry.make()
  registry.mount(atoms.mountAtom)
  registry.mount(atoms.fieldErrorsAtom)
  registry.mount(atoms.rootErrorAtom)
  registry.set(atoms.initializeAtom, defaults)
  const fieldError = (key: "slug" | "email" | "address") => {
    const error = atoms.getFieldAtoms<unknown>(atoms.fieldRefs[key]).error
    registry.mount(error)
    return () => registry.get(error)
  }
  return { atoms, registry, fieldError }
}

const settledSubmit = (
  registry: AtomRegistry.AtomRegistry,
  submitAtom: Atom.Atom<AsyncResult.AsyncResult<any, any>>
) =>
  vi.waitFor(() => {
    const current = registry.get(submitAtom)
    if (AsyncResult.isInitial(current) || current.waiting) throw new Error("submit still running")
    return current
  })

const submit = async (form: ReturnType<typeof makeForm>) => {
  form.registry.set(form.atoms.submitAtom, undefined)
  return settledSubmit(form.registry, form.atoms.submitAtom)
}

const validate = async (form: ReturnType<typeof makeForm>) => {
  form.registry.set(form.atoms.validateAtom, undefined)
  return settledSubmit(form.registry, form.atoms.validateAtom)
}

const setField = (form: ReturnType<typeof makeForm>, key: "slug" | "email" | "address", value: any) =>
  form.registry.set(form.atoms.getFieldAtoms<unknown>(form.atoms.fieldRefs[key]).setValue, value)

describe("submitErrors", () => {
  describe("mapping a failed onSubmit", () => {
    it("shows the mapped messages as field and form errors while submit still fails with the domain error", async () => {
      const rejection = reject([
        { path: "slug", message: "Slug taken" },
        { path: "items[1].name", message: "Unknown product" },
        { path: "", message: "Could not save" }
      ])
      const form = makeForm({ onSubmit: () => Effect.fail(rejection) })
      const slugError = form.fieldError("slug")

      const result = await submit(form)

      expect(AsyncResult.isFailure(result)).toBe(true)
      if (AsyncResult.isFailure(result)) expect(Cause.squash(result.cause)).toBe(rejection)
      expect(slugError()).toEqual(Option.some("Slug taken"))
      expect(form.registry.get(form.atoms.rootErrorAtom)).toEqual(Option.some("Could not save"))
      expect([...form.registry.get(form.atoms.fieldErrorsAtom)]).toEqual([
        ["slug", "Slug taken"],
        ["items[1].name", "Unknown product"]
      ])
      expect(form.registry.get(form.atoms.lastSubmittedValuesAtom)).toEqual(Option.none())
    })

    it("keeps the first message when two entries share a path", async () => {
      const form = makeForm({
        onSubmit: () => Effect.fail(reject([{ path: "slug", message: "First" }, { path: "slug", message: "Second" }]))
      })
      const slugError = form.fieldError("slug")
      await submit(form)
      expect(slugError()).toEqual(Option.some("First"))
    })

    it("does not run when the values fail the schema", async () => {
      const submitErrors = vi.fn(toSubmitErrors)
      const onSubmit = vi.fn(() => Effect.fail(reject([])))
      const form = makeForm({ onSubmit, submitErrors })
      setField(form, "slug", "ab")
      await submit(form)
      expect(onSubmit).not.toHaveBeenCalled()
      expect(submitErrors).not.toHaveBeenCalled()
    })

    it("does not run for a defect or a rejected Promise", async () => {
      const submitErrors = vi.fn(toSubmitErrors)
      const dies = makeForm({ onSubmit: () => Effect.die(new Error("boom")), submitErrors })
      expect(AsyncResult.isFailure(await submit(dies))).toBe(true)

      const rejects = makeForm({ onSubmit: () => Promise.reject(new Error("boom")), submitErrors })
      expect(AsyncResult.isFailure(await submit(rejects))).toBe(true)

      expect(submitErrors).not.toHaveBeenCalled()
    })

    it("turns a throwing mapper into a defect and stores nothing", async () => {
      const form = makeForm({
        onSubmit: () => Effect.fail(reject([])),
        submitErrors: () => {
          throw new Error("mapper bug")
        }
      })
      const result = await submit(form)
      expect(AsyncResult.isFailure(result) && Cause.hasDies(result.cause)).toBe(true)
      expect(form.registry.get(form.atoms.fieldErrorsAtom).size).toBe(0)
      expect(form.registry.get(form.atoms.rootErrorAtom)).toEqual(Option.none())
    })

    it.each([
      ["a misspelled key", "slugg"],
      ["a nested struct path", "address.city"],
      ["an item index that was not submitted", "items[2].name"],
      ["an unknown item property", "items[0].nmae"],
      ["a non-canonical index", "items[01].name"],
      ["a dotted index", "items.0.name"]
    ])("fails loudly for %s and stores nothing", async (_, path) => {
      const form = makeForm({
        onSubmit: () => Effect.fail(reject([{ path: "slug", message: "Slug taken" }, { path, message: "x" }]))
      })
      const slugError = form.fieldError("slug")
      const result = await submit(form)
      expect(AsyncResult.isFailure(result)).toBe(true)
      if (AsyncResult.isFailure(result)) {
        expect(Cause.hasDies(result.cause)).toBe(true)
        expect(String(Cause.squash(result.cause))).toContain(`"${path}"`)
      }
      expect(slugError()).toEqual(Option.none())
    })
  })

  describe("visibility", () => {
    it("hides a field error after an edit and shows it again when the rejected value comes back", async () => {
      const form = makeForm({ onSubmit: () => Effect.fail(reject([{ path: "address", message: "Not served" }])) })
      const addressError = form.fieldError("address")
      await submit(form)
      expect(addressError()).toEqual(Option.some("Not served"))

      setField(form, "address", { city: "Cusco" })
      expect(addressError()).toEqual(Option.none())
      expect(form.registry.get(form.atoms.fieldErrorsAtom).has("address")).toBe(false)

      setField(form, "address", { city: "Lima" })
      expect(addressError()).toEqual(Option.some("Not served"))
    })

    it("lets a live schema error on the field take precedence while it holds the rejected value", async () => {
      const unavailable = new Set<string>()
      const SlugSchema = Schema.String.pipe(
        Schema.decode({
          decode: SchemaGetter.checkEffect((slug: string) =>
            Effect.succeed(unavailable.has(slug) ? "Unavailable right now" : undefined)
          ),
          encode: SchemaGetter.passthrough()
        })
      )
      const liveBuilder = FormBuilder.empty
        .addField("slug", SlugSchema)
        .addField("email", Schema.String)
        .addField("address", Schema.Struct({ city: Schema.String }))
        .addField(Field.makeArrayField("items", ItemSchema))
      const form = makeForm({
        formBuilder: liveBuilder,
        mode: { validation: "onChange" },
        onSubmit: () => Effect.fail(reject([{ path: "slug", message: "Slug taken" }]))
      })
      form.registry.mount(form.atoms.getOrCreateFieldAtoms("slug", SlugSchema).triggerValidationAtom)
      const slugError = form.fieldError("slug")
      await submit(form)
      expect(slugError()).toEqual(Option.some("Slug taken"))

      unavailable.add("taken")
      setField(form, "slug", "takenx")
      setField(form, "slug", "taken")
      await vi.waitFor(() => expect(slugError()).toEqual(Option.some("Unavailable right now")))
    })

    it("hides an item error when its value changes", async () => {
      const form = makeForm({ onSubmit: () => Effect.fail(reject([{ path: "items[0].name", message: "Unknown" }])) })
      await submit(form)
      expect(form.registry.get(form.atoms.fieldErrorsAtom).get("items[0].name")).toBe("Unknown")

      form.registry.set(form.atoms.getOrCreateFieldAtoms("items[0].name", ItemSchema.fields.name).valueAtom, "Pencil")
      expect(form.registry.get(form.atoms.fieldErrorsAtom).has("items[0].name")).toBe(false)
    })
  })

  describe("lifetime", () => {
    const rejectAll = () =>
      Effect.fail(reject([{ path: "slug", message: "Slug taken" }, { path: "", message: "Could not save" }]))

    it("survives validate", async () => {
      const form = makeForm({ onSubmit: rejectAll })
      const slugError = form.fieldError("slug")
      await submit(form)

      form.registry.set(form.atoms.validateAtom, undefined)
      await settledSubmit(form.registry, form.atoms.validateAtom)

      expect(slugError()).toEqual(Option.some("Slug taken"))
      expect(form.registry.get(form.atoms.rootErrorAtom)).toEqual(Option.some("Could not save"))
    })

    it("is cleared when the next submit starts and stays clear when it succeeds", async () => {
      let fail = true
      let finish: (() => void) | undefined
      const form = makeForm({
        onSubmit: () =>
          fail ? rejectAll() : Effect.callback<void>((resume) => {
            finish = () => resume(Effect.void)
          })
      })
      const slugError = form.fieldError("slug")
      await submit(form)
      expect(slugError()).toEqual(Option.some("Slug taken"))

      fail = false
      form.registry.set(form.atoms.submitAtom, undefined)
      await vi.waitFor(() => expect(finish).toBeDefined())
      expect(slugError()).toEqual(Option.none())
      expect(form.registry.get(form.atoms.rootErrorAtom)).toEqual(Option.none())

      finish?.()
      expect(AsyncResult.isSuccess(await settledSubmit(form.registry, form.atoms.submitAtom))).toBe(true)
      expect(slugError()).toEqual(Option.none())
    })

    it("is cleared by reset and by initialize", async () => {
      const form = makeForm({ onSubmit: rejectAll })
      const slugError = form.fieldError("slug")

      await submit(form)
      form.registry.set(form.atoms.resetAtom, undefined)
      await validate(form)
      expect(form.registry.get(form.atoms.rootErrorAtom)).toEqual(Option.none())
      expect(slugError()).toEqual(Option.none())

      await submit(form)
      form.registry.set(form.atoms.initializeAtom, defaults)
      await validate(form)
      expect(form.registry.get(form.atoms.rootErrorAtom)).toEqual(Option.none())
      expect(slugError()).toEqual(Option.none())
    })

    it("clears only the form-level error on revertToLastSubmit and setValues", async () => {
      const form = makeForm({ onSubmit: rejectAll })
      const slugError = form.fieldError("slug")

      await submit(form)
      form.registry.set(form.atoms.revertToLastSubmitAtom, undefined)
      expect(form.registry.get(form.atoms.rootErrorAtom)).toEqual(Option.none())
      expect(slugError()).toEqual(Option.some("Slug taken"))

      await submit(form)
      form.registry.set(form.atoms.setValuesAtom, { ...defaults, email: "c@d.io" })
      expect(form.registry.get(form.atoms.rootErrorAtom)).toEqual(Option.none())
      expect(slugError()).toEqual(Option.some("Slug taken"))
    })

    it("shows a schema form-level error over the submit form-level error and falls back to it", async () => {
      const refined = builder.refine((values) => values.email.endsWith(".io") ? undefined : "Use a .io address")
      const form = makeForm({ formBuilder: refined, onSubmit: rejectAll })
      await submit(form)
      expect(form.registry.get(form.atoms.rootErrorAtom)).toEqual(Option.some("Could not save"))

      setField(form, "email", "a@b.com")
      form.registry.set(form.atoms.validateAtom, undefined)
      await settledSubmit(form.registry, form.atoms.validateAtom)
      expect(form.registry.get(form.atoms.rootErrorAtom)).toEqual(Option.some("Use a .io address"))

      setField(form, "email", "a@b.io")
      form.registry.set(form.atoms.validateAtom, undefined)
      await settledSubmit(form.registry, form.atoms.validateAtom)
      expect(form.registry.get(form.atoms.rootErrorAtom)).toEqual(Option.some("Could not save"))
    })

    it("is not written by a submit that fails after the form was initialized again", async () => {
      let failSubmit: (() => void) | undefined
      const form = makeForm({
        onSubmit: () =>
          Effect.callback<void, SignupRejected>((resume) => {
            failSubmit = () => resume(rejectAll())
          })
      })
      const slugError = form.fieldError("slug")
      form.registry.set(form.atoms.submitAtom, undefined)
      await vi.waitFor(() => expect(failSubmit).toBeDefined())

      form.registry.set(form.atoms.initializeAtom, defaults)
      failSubmit?.()
      await settledSubmit(form.registry, form.atoms.submitAtom)
      await validate(form)

      expect(slugError()).toEqual(Option.none())
      expect(form.registry.get(form.atoms.rootErrorAtom)).toEqual(Option.none())
    })
  })

  describe("fieldErrorsAtom", () => {
    it("is empty before the form is initialized", () => {
      const atoms = FormAtoms.make({ runtime: Atom.runtime(Layer.empty), formBuilder: builder, onSubmit: () => {} })
      const registry = AtomRegistry.make()
      registry.mount(atoms.fieldErrorsAtom)
      expect(registry.get(atoms.fieldErrorsAtom).size).toBe(0)
    })

    it("does not notify subscribers when an edit leaves the displayed errors unchanged", async () => {
      const form = makeForm({ onSubmit: () => Effect.fail(reject([{ path: "slug", message: "Slug taken" }])) })
      await submit(form)
      const notified = vi.fn()
      const unsubscribe = form.registry.subscribe(form.atoms.fieldErrorsAtom, notified)

      setField(form, "email", "x@y.io")
      setField(form, "email", "x@y.iox")
      expect(notified).not.toHaveBeenCalled()

      setField(form, "slug", "free")
      expect(notified).toHaveBeenCalledTimes(1)
      unsubscribe()
    })

    it("lists displayed schema errors for top-level and item paths in field order", async () => {
      const strictBuilder = FormBuilder.empty
        .addField("slug", Schema.String.pipe(Schema.check(Schema.isMinLength(3, { message: "Too short" }))))
        .addField(
          Field.makeArrayField(
            "items",
            Schema.Struct({ name: Schema.String.pipe(Schema.check(Schema.isNonEmpty({ message: "Required" }))) })
          )
        )
      const atoms = FormAtoms.make({
        runtime: Atom.runtime(Layer.empty),
        formBuilder: strictBuilder,
        onSubmit: () => {}
      })
      const registry = AtomRegistry.make()
      registry.mount(atoms.fieldErrorsAtom)
      registry.set(atoms.initializeAtom, { slug: "ab", items: [{ name: "Pen" }, { name: "" }] })

      registry.set(atoms.submitAtom, undefined)
      await settledSubmit(registry, atoms.submitAtom)

      expect([...registry.get(atoms.fieldErrorsAtom)]).toEqual([
        ["slug", "Too short"],
        ["items[1].name", "Required"]
      ])
    })
  })
})

describe("submitErrors kept while a schema form-level error hides them", () => {
  it("falls back to the submit form-level error when rootErrorAtom is the only reader", async () => {
    const refined = builder.refine((values) => values.email.endsWith(".io") ? undefined : "Use a .io address")
    const atoms = FormAtoms.make({
      runtime: Atom.runtime(Layer.empty),
      formBuilder: refined,
      onSubmit: () => Effect.fail(reject([{ path: "", message: "Could not save" }])),
      submitErrors: toSubmitErrors
    })
    const registry = AtomRegistry.make()
    registry.mount(atoms.stateAtom)
    registry.mount(atoms.rootErrorAtom)
    registry.set(atoms.initializeAtom, defaults)
    const setEmail = atoms.getFieldAtoms<string>(atoms.fieldRefs.email).setValue

    registry.set(atoms.submitAtom, undefined)
    await settledSubmit(registry, atoms.submitAtom)
    expect(registry.get(atoms.rootErrorAtom)).toEqual(Option.some("Could not save"))

    registry.set(setEmail, "a@b.com")
    registry.set(atoms.validateAtom, undefined)
    await settledSubmit(registry, atoms.validateAtom)
    expect(registry.get(atoms.rootErrorAtom)).toEqual(Option.some("Use a .io address"))
    await new Promise((resolve) => setTimeout(resolve, 0))

    registry.set(setEmail, "a@b.io")
    registry.set(atoms.validateAtom, undefined)
    await settledSubmit(registry, atoms.validateAtom)
    expect(registry.get(atoms.rootErrorAtom)).toEqual(Option.some("Could not save"))
  })
})

describe("submitErrors kept with no field mounted", () => {
  it("keeps the rejection when only mountAtom reads it and a field mounts later", async () => {
    const atoms = FormAtoms.make({
      runtime: Atom.runtime(Layer.empty),
      formBuilder: builder,
      onSubmit: () => Effect.fail(reject([{ path: "slug", message: "Slug taken" }, { path: "", message: "Root" }])),
      submitErrors: toSubmitErrors
    })
    const registry = AtomRegistry.make()
    registry.mount(atoms.mountAtom)
    registry.set(atoms.initializeAtom, defaults)
    registry.set(atoms.submitAtom, undefined)
    await settledSubmit(registry, atoms.submitAtom)
    await new Promise((resolve) => setTimeout(resolve, 0))

    const error = atoms.getFieldAtoms<unknown>(atoms.fieldRefs.slug).error
    registry.mount(error)
    expect(registry.get(error)).toEqual(Option.some("Slug taken"))
    registry.mount(atoms.rootErrorAtom)
    expect(registry.get(atoms.rootErrorAtom)).toEqual(Option.some("Root"))
  })
})

describe("submitErrors with wrapped struct items", () => {
  const submitAndReadFieldErrors = async (
    atoms:
      & { readonly fieldErrorsAtom: Atom.Atom<ReadonlyMap<string, string>> }
      & Pick<
        FormAtoms.FormAtoms<any, never, void, SignupRejected>,
        "initializeAtom" | "submitAtom"
      >
  ) => {
    const registry = AtomRegistry.make()
    registry.mount(atoms.fieldErrorsAtom)
    registry.set(atoms.initializeAtom, { items: [{ name: "x" }] })
    registry.set(atoms.submitAtom, undefined)
    await settledSubmit(registry, atoms.submitAtom)
    return [...registry.get(atoms.fieldErrorsAtom)]
  }

  it("accepts an item path for a branded item schema", async () => {
    const atoms = FormAtoms.make({
      runtime: Atom.runtime(Layer.empty),
      formBuilder: FormBuilder.empty.addField(
        Field.makeArrayField("items", Schema.Struct({ name: Schema.String }).pipe(Schema.brand("Item")))
      ),
      onSubmit: () => Effect.fail(reject([])),
      submitErrors: () => [{ path: "items[0].name", message: "Bad" }]
    })
    expect(await submitAndReadFieldErrors(atoms)).toEqual([["items[0].name", "Bad"]])
  })

  it("accepts an item path for a suspended item schema", async () => {
    const atoms = FormAtoms.make({
      runtime: Atom.runtime(Layer.empty),
      formBuilder: FormBuilder.empty.addField(
        Field.makeArrayField("items", Schema.suspend(() => Schema.Struct({ name: Schema.String })))
      ),
      onSubmit: () => Effect.fail(reject([])),
      submitErrors: () => [{ path: "items[0].name", message: "Bad" }]
    })
    expect(await submitAndReadFieldErrors(atoms)).toEqual([["items[0].name", "Bad"]])
  })
})
