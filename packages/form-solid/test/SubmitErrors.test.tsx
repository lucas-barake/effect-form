import { useAtomSet, useAtomValue } from "@effect/atom-solid"
import { Field, FormBuilder, FormSolid } from "@lucas-barake/effect-form-solid"
import { render, screen } from "@solidjs/testing-library"
import { userEvent } from "@testing-library/user-event"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { For, Index, Show } from "solid-js"
import { describe, expect, it } from "vitest"

class SlugTaken extends Schema.TaggedError<SlugTaken>()("SlugTaken", {}) {}

const makeInput = (testId: string): FormSolid.FieldComponent<string> => ({ field }) => (
  <div>
    <input
      value={field().value}
      onInput={(e) => field().onChange(e.currentTarget.value)}
      onBlur={field().onBlur}
      data-testid={testId}
    />
    <Show when={Option.getOrUndefined(field().error)}>
      {(message) => <span data-testid={`${testId}-error`}>{message()}</span>}
    </Show>
  </div>
)

describe("submitErrors with FormSolid", () => {
  it("shows mapped errors in field components, the summary and rootError", async () => {
    const user = userEvent.setup()
    const builder = FormBuilder.empty
      .addField("slug", Schema.String)
      .addField(Field.makeArrayField("items", Schema.Struct({ name: Schema.String })))
    const form = FormSolid.make(builder, {
      fields: { slug: makeInput("slug"), items: { name: makeInput("item-name") } },
      onSubmit: () => Effect.fail(new SlugTaken()),
      submitErrors: () => [
        { path: "slug", message: "Taken" },
        { path: "items[0].name", message: "Unknown product" },
        { path: "", message: "Could not save" }
      ]
    })

    const SubmitButton = () => {
      const submit = useAtomSet(() => form.submit)
      return <button onClick={() => submit()} data-testid="submit">Submit</button>
    }
    const ErrorSummary = () => {
      const errors = useAtomValue(() => form.fieldErrors)
      return (
        <ul data-testid="summary">
          <For each={[...errors()]}>{([path, message]) => <li>{`${path}: ${message}`}</li>}</For>
        </ul>
      )
    }
    const RootError = () => {
      const rootError = useAtomValue(() => form.rootError)
      return <p data-testid="root-error">{Option.getOrElse(rootError(), () => "")}</p>
    }

    render(() => (
      <form.Initialize defaultValues={{ slug: "taken", items: [{ name: "Pen" }] }}>
        <form.slug />
        <form.items>
          {(ops) => (
            <Index each={ops.items}>
              {(_item, index) => (
                <form.items.Item index={index}>
                  <form.items.name />
                </form.items.Item>
              )}
            </Index>
          )}
        </form.items>
        <RootError />
        <ErrorSummary />
        <SubmitButton />
      </form.Initialize>
    ))

    await user.click(screen.getByTestId("submit"))
    expect(await screen.findByTestId("slug-error")).toHaveTextContent("Taken")
    expect(screen.getByTestId("item-name-error")).toHaveTextContent("Unknown product")
    expect(screen.getByTestId("root-error")).toHaveTextContent("Could not save")
    expect([...screen.getByTestId("summary").querySelectorAll("li")].map((li) => li.textContent)).toEqual([
      "slug: Taken",
      "items[0].name: Unknown product"
    ])

    await user.type(screen.getByTestId("slug"), "x")
    expect(screen.queryByTestId("slug-error")).toBeNull()
  })
})
