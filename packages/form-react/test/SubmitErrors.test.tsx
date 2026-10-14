import { RegistryContext, useAtomSet, useAtomValue } from "@effect/atom-react"
import { Field, FormBuilder, FormReact } from "@lucas-barake/effect-form-react"
import { render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import * as Schema from "effect/Schema"
import { describe, expect, it } from "vitest"

class SlugTaken extends Schema.TaggedError<SlugTaken>()("SlugTaken", {}) {}

class UnknownProduct extends Schema.TaggedError<UnknownProduct>()("UnknownProduct", { index: Schema.Number }) {}

const makeInput = (testId: string): FormReact.FieldComponent<string> => ({ field }) => (
  <div>
    <input
      value={field.value}
      onChange={(e) => field.onChange(e.target.value)}
      onBlur={field.onBlur}
      data-testid={testId}
    />
    {Option.isSome(field.error) && <span data-testid={`${testId}-error`}>{field.error.value}</span>}
  </div>
)

const builder = FormBuilder.empty
  .addField("slug", Schema.String)
  .addField(
    Field.makeArrayField(
      "items",
      Schema.Struct({ name: Schema.String.pipe(Schema.check(Schema.isNonEmpty({ message: "Name is required" }))) })
    )
  )

const fields = { slug: makeInput("slug"), items: { name: makeInput("item-name") } }

type Fields = typeof builder extends FormBuilder.FormBuilder<infer F, any> ? F : never

const renderForm = <E,>(
  form: FormReact.BuiltForm<Fields, never, void, E, void, typeof fields>,
  defaultValues: { readonly slug: string; readonly items: ReadonlyArray<{ readonly name: string }> }
) => {
  const SubmitButton = () => {
    const submit = useAtomSet(form.submit)
    return <button onClick={() => submit()} data-testid="submit">Submit</button>
  }
  const ErrorSummary = () => {
    const errors = useAtomValue(form.fieldErrors)
    return (
      <ul data-testid="summary">
        {[...errors].map(([path, message]) => <li key={path}>{`${path}: ${message}`}</li>)}
      </ul>
    )
  }
  const RootError = () => {
    const rootError = useAtomValue(form.rootError)
    return Option.isSome(rootError) ? <p data-testid="root-error">{rootError.value}</p> : null
  }
  const registry = AtomRegistry.make()
  render(
    <RegistryContext.Provider value={registry}>
      <form.Initialize defaultValues={defaultValues}>
        <form.slug />
        <form.items>
          {({ items }) =>
            items.map((_, index) => (
              <form.items.Item key={index} index={index}>
                <form.items.name />
              </form.items.Item>
            ))}
        </form.items>
        <RootError />
        <ErrorSummary />
        <SubmitButton />
      </form.Initialize>
    </RegistryContext.Provider>
  )
  return { registry }
}

const summaryLines = () => [...screen.getByTestId("summary").querySelectorAll("li")].map((li) => li.textContent)

describe("submitErrors with FormReact", () => {
  it("shows a rejected field's message in its component until the value changes, and again when it comes back", async () => {
    const user = userEvent.setup()
    const form = FormReact.make(builder, {
      fields,
      onSubmit: (_: void, { decoded }) => decoded.slug === "taken" ? Effect.fail(new SlugTaken()) : Effect.void,
      submitErrors: () => [{ path: "slug", message: "This slug is already in use." }]
    })
    renderForm(form, { slug: "taken", items: [] })

    await user.click(screen.getByTestId("submit"))
    expect(await screen.findByTestId("slug-error")).toHaveTextContent("This slug is already in use.")
    expect(summaryLines()).toEqual(["slug: This slug is already in use."])

    await user.type(screen.getByTestId("slug"), "x")
    expect(screen.queryByTestId("slug-error")).toBeNull()
    expect(summaryLines()).toEqual([])

    await user.type(screen.getByTestId("slug"), "{Backspace}")
    expect(screen.getByTestId("slug-error")).toHaveTextContent("This slug is already in use.")
  })

  it("routes array item and form-level errors to the item component, the summary and rootError", async () => {
    const user = userEvent.setup()
    const form = FormReact.make(builder, {
      fields,
      onSubmit: () => Effect.fail(new UnknownProduct({ index: 1 })),
      submitErrors: (error) => [
        { path: `items[${error.index}].name`, message: "Unknown product" },
        { path: "", message: "Could not save" }
      ]
    })
    renderForm(form, { slug: "site", items: [{ name: "Pen" }, { name: "Ink" }] })

    await user.click(screen.getByTestId("submit"))
    expect(await screen.findByTestId("root-error")).toHaveTextContent("Could not save")
    expect(screen.getAllByTestId("item-name-error")).toHaveLength(1)
    expect(screen.getAllByTestId("item-name")[1]?.parentElement).toContainElement(
      screen.getByTestId("item-name-error")
    )
    expect(summaryLines()).toEqual(["items[1].name: Unknown product"])
  })

  it("lists the live validation error an array item component shows in the summary", async () => {
    const user = userEvent.setup()
    const form = FormReact.make(builder, {
      fields,
      mode: { validation: "onChange" },
      onSubmit: () => Effect.void
    })
    renderForm(form, { slug: "site", items: [{ name: "Pen" }] })

    await user.clear(screen.getByTestId("item-name"))
    expect(await screen.findByTestId("item-name-error")).toHaveTextContent("Name is required")
    await waitFor(() => expect(summaryLines()).toEqual(["items[0].name: Name is required"]))
  })

  it("maps the failure of a mutation atom run from onSubmit with get.setResult", async () => {
    const user = userEvent.setup()
    const createSite = Atom.fn((_input: { readonly slug: string }) => Effect.fail(new SlugTaken()))
    const form = FormReact.make(builder, {
      fields,
      onSubmit: (_: void, { decoded, get }) => get.setResult(createSite, { slug: decoded.slug }),
      submitErrors: (error) => error._tag === "SlugTaken" ? [{ path: "slug", message: "Taken" }] : []
    })
    const { registry } = renderForm(form, { slug: "taken", items: [] })
    registry.mount(createSite)

    await user.click(screen.getByTestId("submit"))
    expect(await screen.findByTestId("slug-error")).toHaveTextContent("Taken")
    const mutation = registry.get(createSite)
    expect(AsyncResult.isFailure(mutation)).toBe(true)
    const submitResult = registry.get(form.submit)
    expect(AsyncResult.isFailure(submitResult)).toBe(true)
  })

  it("rejects a misspelled path at compile time", () => {
    FormReact.make(builder, {
      fields,
      onSubmit: () => Effect.fail(new SlugTaken()),
      // @ts-expect-error "slugg" is not a field path of this form
      submitErrors: () => [{ path: "slugg", message: "Taken" }]
    })
  })
})

describe("submitErrors kept while no field reads them", () => {
  it("shows the rejection once the field returns to the rejected value after an in-flight edit hid it", async () => {
    const user = userEvent.setup()
    let failSubmit: (() => void) | undefined
    const strictBuilder = FormBuilder.empty.addField(
      "slug",
      Schema.String.pipe(Schema.check(Schema.isMinLength(3, { message: "Too short" })))
    )
    const form = FormReact.make(strictBuilder, {
      fields: { slug: makeInput("slug") },
      mode: { validation: "onChange" },
      onSubmit: () =>
        Effect.callback<void, SlugTaken>((resume) => {
          failSubmit = () => resume(Effect.fail(new SlugTaken()))
        }),
      submitErrors: () => [{ path: "slug", message: "This slug is already in use." }]
    })
    const SubmitButton = () => {
      const submit = useAtomSet(form.submit)
      return <button onClick={() => submit()} data-testid="submit">Submit</button>
    }
    const registry = AtomRegistry.make()
    render(
      <RegistryContext.Provider value={registry}>
        <form.Initialize defaultValues={{ slug: "taken" }}>
          <form.slug />
          <SubmitButton />
        </form.Initialize>
      </RegistryContext.Provider>
    )

    await user.click(screen.getByTestId("submit"))
    await waitFor(() => expect(failSubmit).toBeDefined())
    await user.clear(screen.getByTestId("slug"))
    await user.type(screen.getByTestId("slug"), "ta")
    expect(await screen.findByTestId("slug-error")).toHaveTextContent("Too short")

    failSubmit?.()
    await waitFor(() => expect(AsyncResult.isFailure(registry.get(form.submit))).toBe(true))
    await new Promise((resolve) => setTimeout(resolve, 0))

    await user.type(screen.getByTestId("slug"), "ken")
    await waitFor(() => expect(screen.getByTestId("slug-error")).toHaveTextContent("This slug is already in use."))
  })
})
