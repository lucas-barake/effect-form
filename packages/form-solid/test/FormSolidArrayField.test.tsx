import { Field, FormBuilder, FormSolid } from "@lucas-barake/effect-form-solid"
import { render, screen, waitFor } from "@solidjs/testing-library"
import { userEvent } from "@testing-library/user-event"
import * as Schema from "effect/Schema"
import { Index } from "solid-js"
import { describe, expect, it } from "vitest"

const ItemNameInput: FormSolid.FieldComponent<string> = ({ field }) => (
  <input
    type="text"
    value={field().value}
    onInput={(e) => field().onChange(e.currentTarget.value)}
    onBlur={field().onBlur}
    data-testid="item-name"
  />
)

describe("FormSolid array field reactivity", () => {
  it("remove removes middle item (Index)", async () => {
    const user = userEvent.setup()
    const ItemsArrayField = Field.makeArrayField("items", Schema.Struct({ name: Schema.String }))
    const formBuilder = FormBuilder.empty.addField(ItemsArrayField)

    const form = FormSolid.make(formBuilder, {
      fields: { items: { name: ItemNameInput } },
      onSubmit: () => {}
    })

    render(() => (
      <form.Initialize defaultValues={{ items: [{ name: "A" }, { name: "B" }, { name: "C" }] }}>
        <form.items>
          {(ops) => (
            <Index each={ops.items}>
              {(_item, i) => (
                <div>
                  <form.items.Item index={i}>
                    <form.items.name />
                  </form.items.Item>
                  <button type="button" onClick={() => ops.remove(i)} data-testid={`remove-${i}`}>
                    Remove
                  </button>
                </div>
              )}
            </Index>
          )}
        </form.items>
      </form.Initialize>
    ))

    let inputs = screen.getAllByTestId("item-name") as Array<HTMLInputElement>
    expect(inputs.map((i) => i.value)).toEqual(["A", "B", "C"])

    await user.click(screen.getByTestId("remove-1"))

    await waitFor(() => {
      const updated = screen.getAllByTestId("item-name") as Array<HTMLInputElement>
      expect(updated).toHaveLength(2)
      expect(updated.map((i) => i.value)).toEqual(["A", "C"])
    })
  })

  it("typing multiple chars into an array item field preserves them (Index)", async () => {
    const user = userEvent.setup()
    const ItemsArrayField = Field.makeArrayField("items", Schema.Struct({ name: Schema.String }))
    const formBuilder = FormBuilder.empty.addField(ItemsArrayField)

    const form = FormSolid.make(formBuilder, {
      fields: { items: { name: ItemNameInput } },
      onSubmit: () => {}
    })

    render(() => (
      <form.Initialize defaultValues={{ items: [{ name: "" }] }}>
        <form.items>
          {(ops) => (
            <Index each={ops.items}>
              {(_item, i) => (
                <form.items.Item index={i}>
                  <form.items.name />
                </form.items.Item>
              )}
            </Index>
          )}
        </form.items>
      </form.Initialize>
    ))

    const input = screen.getByTestId("item-name") as HTMLInputElement
    await user.type(input, "Hello")

    await waitFor(() => {
      expect((screen.getByTestId("item-name") as HTMLInputElement).value).toBe("Hello")
    })
  })

  it("append adds a row (Index)", async () => {
    const user = userEvent.setup()
    const ItemsArrayField = Field.makeArrayField("items", Schema.Struct({ name: Schema.String }))
    const formBuilder = FormBuilder.empty.addField(ItemsArrayField)

    const form = FormSolid.make(formBuilder, {
      fields: { items: { name: ItemNameInput } },
      onSubmit: () => {}
    })

    render(() => (
      <form.Initialize defaultValues={{ items: [{ name: "Item 1" }] }}>
        <form.items>
          {(ops) => (
            <>
              <Index each={ops.items}>
                {(_item, i) => (
                  <form.items.Item index={i}>
                    <form.items.name />
                  </form.items.Item>
                )}
              </Index>
              <button type="button" onClick={() => ops.append()} data-testid="add">
                Add
              </button>
            </>
          )}
        </form.items>
      </form.Initialize>
    ))

    expect(screen.getAllByTestId("item-name")).toHaveLength(1)
    await user.click(screen.getByTestId("add"))
    await waitFor(() => {
      expect(screen.getAllByTestId("item-name")).toHaveLength(2)
    })
  })
})
