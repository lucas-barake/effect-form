import { useAtomSet, useAtomSubscribe } from "@effect/atom-solid"
import { Field, FormBuilder, FormSolid } from "@lucas-barake/effect-form-solid"
import { render, screen, waitFor } from "@solidjs/testing-library"
import { userEvent } from "@testing-library/user-event"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import type * as Atom from "effect/unstable/reactivity/Atom"
import { describe, expect, it, vi } from "vitest"

const TextInput: FormSolid.FieldComponent<string> = ({ field }) => (
  <div>
    <input
      type="text"
      value={field().value}
      onInput={(e) => field().onChange(e.currentTarget.value)}
      onBlur={field().onBlur}
      data-testid="text-input"
    />
    {Option.isSome(field().error) && <span data-testid="error">{field().error.valueOrUndefined!}</span>}
  </div>
)

const makeSubmitButton = <A,>(submitAtom: Atom.AtomResultFn<A, unknown, unknown>, args: A) => {
  const SubmitButton = () => {
    const submit = useAtomSet(() => submitAtom)
    return <button onClick={() => submit(args)} data-testid="submit">Submit</button>
  }
  return SubmitButton
}

describe("FormSolid.make", () => {
  describe("Initialize Component", () => {
    it("initializes with default values", () => {
      const NameField = Field.makeField("name", Schema.String)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const form = FormSolid.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit: () => {}
      })

      render(() => (
        <form.Initialize defaultValues={{ name: "John" }}>
          <form.name />
        </form.Initialize>
      ))

      expect(screen.getByTestId("text-input")).toHaveValue("John")
    })
  })

  describe("Field Component", () => {
    it("updates value on change", async () => {
      const user = userEvent.setup()

      const NameField = Field.makeField("name", Schema.String)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const form = FormSolid.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit: () => {}
      })

      render(() => (
        <form.Initialize defaultValues={{ name: "" }}>
          <form.name />
        </form.Initialize>
      ))

      const input = screen.getByTestId("text-input")
      await user.type(input, "Jane")

      expect(input).toHaveValue("Jane")
    })

    it("shows validation error after touch (onBlur mode)", async () => {
      const user = userEvent.setup()

      const NonEmpty = Schema.String.pipe(Schema.check(Schema.isMinLength(1, { message: "Required" })))
      const NameField = Field.makeField("name", NonEmpty)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const form = FormSolid.make(formBuilder, {
        fields: { name: TextInput },
        mode: { validation: "onBlur" },
        onSubmit: () => {}
      })

      render(() => (
        <form.Initialize defaultValues={{ name: "" }}>
          <form.name />
        </form.Initialize>
      ))

      const input = screen.getByTestId("text-input")
      await user.click(input)
      await user.tab()

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("Required")
      })
    })
  })

  describe("isDirty atom", () => {
    it("returns isDirty = false when values match initial", () => {
      const NameField = Field.makeField("name", Schema.String)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const form = FormSolid.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit: () => {}
      })

      let isDirty: boolean | undefined

      const TestComponent = () => {
        useAtomSubscribe(() => form.isDirty, (dirty) => {
          isDirty = dirty
        }, { immediate: true })
        return null
      }

      render(() => (
        <form.Initialize defaultValues={{ name: "test" }}>
          <form.name />
          <TestComponent />
        </form.Initialize>
      ))

      expect(isDirty).toBe(false)
    })

    it("returns isDirty = true when values differ from initial", async () => {
      const user = userEvent.setup()

      const NameField = Field.makeField("name", Schema.String)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const form = FormSolid.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit: () => {}
      })

      let isDirty: boolean | undefined

      const TestComponent = () => {
        useAtomSubscribe(() => form.isDirty, (dirty) => {
          isDirty = dirty
        }, { immediate: true })
        return null
      }

      render(() => (
        <form.Initialize defaultValues={{ name: "" }}>
          <form.name />
          <TestComponent />
        </form.Initialize>
      ))

      const input = screen.getByTestId("text-input")
      await user.type(input, "changed")

      expect(isDirty).toBe(true)
    })
  })

  describe("multiple fields", () => {
    it("renders multiple fields correctly", async () => {
      const user = userEvent.setup()

      const FirstNameField = Field.makeField("firstName", Schema.String)
      const LastNameField = Field.makeField("lastName", Schema.String)
      const formBuilder = FormBuilder.empty.addField(FirstNameField).addField(LastNameField)

      const FirstNameInput: FormSolid.FieldComponent<string> = ({ field }) => (
        <input
          type="text"
          value={field().value}
          onInput={(e) => field().onChange(e.currentTarget.value)}
          onBlur={field().onBlur}
          data-testid="firstName"
        />
      )

      const LastNameInput: FormSolid.FieldComponent<string> = ({ field }) => (
        <input
          type="text"
          value={field().value}
          onInput={(e) => field().onChange(e.currentTarget.value)}
          onBlur={field().onBlur}
          data-testid="lastName"
        />
      )

      const form = FormSolid.make(formBuilder, {
        fields: {
          firstName: FirstNameInput,
          lastName: LastNameInput
        },
        onSubmit: () => {}
      })

      render(() => (
        <form.Initialize defaultValues={{ firstName: "", lastName: "" }}>
          <form.firstName />
          <form.lastName />
        </form.Initialize>
      ))

      await user.type(screen.getByTestId("firstName"), "John")
      await user.type(screen.getByTestId("lastName"), "Doe")

      expect(screen.getByTestId("firstName")).toHaveValue("John")
      expect(screen.getByTestId("lastName")).toHaveValue("Doe")
    })
  })

  describe("array fields", () => {
    it("throws a descriptive error when array field renders outside Initialize", () => {
      const ItemsArrayField = Field.makeArrayField("items", Schema.Struct({ name: Schema.String }))
      const formBuilder = FormBuilder.empty.addField(ItemsArrayField)

      const ItemNameInput: FormSolid.FieldComponent<string> = ({ field }) => (
        <input
          type="text"
          value={field().value}
          onInput={(e) => field().onChange(e.currentTarget.value)}
          data-testid="item-name"
        />
      )

      const form = FormSolid.make(formBuilder, {
        fields: { items: { name: ItemNameInput } },
        onSubmit: () => {}
      })

      expect(() =>
        render(() => (
          <form.items>
            {() => null}
          </form.items>
        ))
      ).toThrowError(`Array field "items" was rendered before the form was initialized`)
      expect(() =>
        render(() => (
          <form.items>
            {() => null}
          </form.items>
        ))
      ).toThrowError(/<form\.Initialize/)
    })
  })

  it("submit calls onSubmit with decoded values", async () => {
    const user = userEvent.setup()
    const submitHandler = vi.fn()

    const NameField = Field.makeField("name", Schema.String)
    const AgeField = Field.makeField("age", Schema.NumberFromString)
    const formBuilder = FormBuilder.empty.addField(NameField).addField(AgeField)

    const NumberFromStringInput: FormSolid.FieldComponent<typeof Schema.NumberFromString> = ({ field }) => (
      <input
        type="text"
        value={field().value}
        onInput={(e) => field().onChange(e.currentTarget.value)}
        onBlur={field().onBlur}
        data-testid="number-input"
      />
    )

    const form = FormSolid.make(formBuilder, {
      fields: { name: TextInput, age: NumberFromStringInput },
      onSubmit: (_: void, { decoded }) => submitHandler(decoded)
    })

    const SubmitButton = makeSubmitButton(form.submit, undefined)

    render(() => (
      <form.Initialize defaultValues={{ name: "John", age: "42" }}>
        <form.name />
        <form.age />
        <SubmitButton />
      </form.Initialize>
    ))

    await user.click(screen.getByTestId("submit"))

    await waitFor(() => {
      expect(submitHandler).toHaveBeenCalledWith({ name: "John", age: 42 })
    })
  })
})
