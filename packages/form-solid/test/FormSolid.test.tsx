import { useAtomSet, useAtomSubscribe, useAtomValue } from "@effectify/solid-effect-atom"
import * as Atom from "@effect-atom/atom/Atom"
import * as Registry from "@effect-atom/atom/Registry"
import * as Result from "@effect-atom/atom/Result"
import { Field, FormBuilder, FormSolid } from "@lucas-barake/effect-form-solid"
import { render, screen, waitFor, cleanup } from "@solidjs/testing-library"
import { userEvent } from "@testing-library/user-event"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { createSignal, Show, For, createEffect } from "solid-js"
import { describe, expect, expectTypeOf, it, vi, afterEach } from "vitest"

afterEach(() => {
  cleanup()
})

const TextInput: FormSolid.FieldComponent<string> = (props) => (
  <div>
    <input
      type="text"
      value={props.field.value}
      onInput={(e) => props.field.onChange(e.currentTarget.value)}
      onBlur={props.field.onBlur}
      data-testid="text-input"
    />
    <Show when={Option.isSome(props.field.error)}>
      <span data-testid="error">{Option.getOrNull(props.field.error)}</span>
    </Show>
  </div>
)

const makeSubmitButton = <A,>(submitAtom: Atom.AtomResultFn<A, unknown, unknown>, args: A) => {
  const SubmitButton = () => {
    const submit = useAtomSet(submitAtom)
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
      const NonEmpty = Schema.String.pipe(Schema.minLength(1, { message: () => "Required" }))
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
        useAtomSubscribe(form.isDirty, (dirty) => {
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
        useAtomSubscribe(form.isDirty, (dirty) => {
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

    it("submit calls onSubmit with decoded values", async () => {
      const user = userEvent.setup()
      const submitHandler = vi.fn()

      const NameField = Field.makeField("name", Schema.String)
      const AgeField = Field.makeField("age", Schema.NumberFromString)
      const formBuilder = FormBuilder.empty.addField(NameField).addField(AgeField)

      const NumberFromStringInput: FormSolid.FieldComponent<typeof Schema.NumberFromString> = (props) => (
        <input
          type="text"
          value={props.field.value}
          onInput={(e) => props.field.onChange(e.currentTarget.value)}
          onBlur={props.field.onBlur}
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

  describe("multiple fields", () => {
    it("renders multiple fields correctly", async () => {
      const user = userEvent.setup()

      const FirstNameField = Field.makeField("firstName", Schema.String)
      const LastNameField = Field.makeField("lastName", Schema.String)
      const formBuilder = FormBuilder.empty.addField(FirstNameField).addField(LastNameField)

      const NamedInput: FormSolid.FieldComponent<string, { name: string }> = (props) => (
        <input
          type="text"
          value={props.field.value}
          onInput={(e) => props.field.onChange(e.currentTarget.value)}
          onBlur={props.field.onBlur}
          data-testid={props.props.name}
        />
      )

      const FirstNameInput: FormSolid.FieldComponent<string> = (props) => (
        <NamedInput field={props.field} props={{ name: "firstName" }} />
      )

      const LastNameInput: FormSolid.FieldComponent<string> = (props) => (
        <NamedInput field={props.field} props={{ name: "lastName" }} />
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
    const ItemNameInput: FormSolid.FieldComponent<string> = (props) => (
      <input
        type="text"
        value={props.field.value}
        onInput={(e) => props.field.onChange(e.currentTarget.value)}
        onBlur={props.field.onBlur}
        data-testid="item-name"
      />
    )

    it("renders array field with items", async () => {
      const user = userEvent.setup()
      const TitleField = Field.makeField("title", Schema.String)
      const ItemsArrayField = Field.makeArrayField("items", Schema.Struct({ name: Schema.String }))
      const formBuilder = FormBuilder.empty.addField(TitleField).addField(ItemsArrayField)

      const form = FormSolid.make(formBuilder, {
        fields: {
          title: TextInput,
          items: { name: ItemNameInput }
        },
        onSubmit: () => {}
      })

      render(() => (
        <form.Initialize
          defaultValues={{ title: "My List", items: [{ name: "Item 1" }] }}
        >
          <form.title />
          <form.items>
            {({ append, items }) => (
              <>
                <For each={items()}>
                  {(item, i) => (
                    <form.items.Item index={i()}>
                      <form.items.name />
                    </form.items.Item>
                  )}
                </For>
                <button type="button" onClick={() => append()} data-testid="add">
                  Add
                </button>
              </>
            )}
          </form.items>
        </form.Initialize>
      ))

      expect(screen.getByTestId("text-input")).toHaveValue("My List")
      expect(screen.getByTestId("item-name")).toHaveValue("Item 1")

      await user.click(screen.getByTestId("add"))

      await waitFor(() => {
        expect(screen.getAllByTestId("item-name")).toHaveLength(2)
      })
    })

    it("renders array item subfields when item schema uses filterEffect", async () => {
      const user = userEvent.setup()

      const ItemSchema = Schema.Struct({ name: Schema.String }).pipe(
        Schema.filterEffect(() => Effect.succeed(true))
      )
      const ItemsArrayField = Field.makeArrayField("items", ItemSchema)
      const formBuilder = FormBuilder.empty.addField(ItemsArrayField)

      const form = FormSolid.make(formBuilder, {
        fields: { items: { name: ItemNameInput } },
        onSubmit: () => {}
      })

      render(() => (
        <form.Initialize defaultValues={{ items: [{ name: "First" }] }}>
          <form.items>
            {({ items }) => (
              <For each={items()}>
                {(item, i) => (
                  <form.items.Item index={i()}>
                    <form.items.name />
                  </form.items.Item>
                )}
              </For>
            )}
          </form.items>
        </form.Initialize>
      ))

      expect((screen.getByTestId("item-name") as HTMLInputElement).value).toBe("First")

      await user.type(screen.getByTestId("item-name"), "A")

      expect((screen.getByTestId("item-name") as HTMLInputElement).value).toBe("FirstA")
    })

    it("remove() removes item at specified index", async () => {
      const user = userEvent.setup()
      const ItemsArrayField = Field.makeArrayField("items", Schema.Struct({ name: Schema.String }))
      const formBuilder = FormBuilder.empty.addField(ItemsArrayField)

      const form = FormSolid.make(formBuilder, {
        fields: { items: { name: ItemNameInput } },
        onSubmit: () => {}
      })

      render(() => (
        <form.Initialize
          defaultValues={{ items: [{ name: "A" }, { name: "B" }, { name: "C" }] }}
        >
          <form.items>
            {({ items, remove }) => (
              <For each={items()}>
                {(item, i) => (
                  <div data-testid={`item-${i()}`}>
                    <form.items.Item index={i()}>
                      <form.items.name />
                    </form.items.Item>
                    <button type="button" onClick={() => remove(i())} data-testid={`remove-${i()}`}>
                      Remove
                    </button>
                  </div>
                )}
              </For>
            )}
          </form.items>
        </form.Initialize>
      ))

      expect(screen.getAllByTestId("item-name")).toHaveLength(3)
      const inputs = screen.getAllByTestId("item-name") as Array<HTMLInputElement>
      expect(inputs[0].value).toBe("A")
      expect(inputs[1].value).toBe("B")
      expect(inputs[2].value).toBe("C")

      await user.click(screen.getByTestId("remove-1"))

      await waitFor(() => {
        expect(screen.getAllByTestId("item-name")).toHaveLength(2)
        const updatedInputs = screen.getAllByTestId("item-name") as Array<HTMLInputElement>
        expect(updatedInputs[0].value).toBe("A")
        expect(updatedInputs[1].value).toBe("C")
      })
    })

    it("swap() exchanges items at two indices", async () => {
      const user = userEvent.setup()

      const ItemsArrayField = Field.makeArrayField("items", Schema.Struct({ name: Schema.String }))
      const formBuilder = FormBuilder.empty.addField(ItemsArrayField)

      const form = FormSolid.make(formBuilder, {
        fields: { items: { name: ItemNameInput } },
        onSubmit: () => {}
      })

      render(() => (
        <form.Initialize
          defaultValues={{ items: [{ name: "First" }, { name: "Second" }, { name: "Third" }] }}
        >
          <form.items>
            {({ items, swap }) => (
              <>
                <For each={items()}>
                  {(item, i) => (
                    <form.items.Item index={i()}>
                      <form.items.name />
                    </form.items.Item>
                  )}
                </For>
                <button type="button" onClick={() => swap(0, 2)} data-testid="swap">
                  Swap First and Third
                </button>
              </>
            )}
          </form.items>
        </form.Initialize>
      ))

      const initialInputs = screen.getAllByTestId("item-name") as Array<HTMLInputElement>
      expect(initialInputs[0].value).toBe("First")
      expect(initialInputs[1].value).toBe("Second")
      expect(initialInputs[2].value).toBe("Third")

      await user.click(screen.getByTestId("swap"))

      await waitFor(() => {
        const swappedInputs = screen.getAllByTestId("item-name") as Array<HTMLInputElement>
        expect(swappedInputs[0].value).toBe("Third")
        expect(swappedInputs[1].value).toBe("Second")
        expect(swappedInputs[2].value).toBe("First")
      })
    })

    it("move() relocates item from one index to another", async () => {
      const user = userEvent.setup()

      const ItemsArrayField = Field.makeArrayField("items", Schema.Struct({ name: Schema.String }))
      const formBuilder = FormBuilder.empty.addField(ItemsArrayField)

      const form = FormSolid.make(formBuilder, {
        fields: { items: { name: ItemNameInput } },
        onSubmit: () => {}
      })

      render(() => (
        <form.Initialize
          defaultValues={{ items: [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }] }}
        >
          <form.items>
            {({ items, move }) => (
              <>
                <For each={items()}>
                  {(item, i) => (
                    <form.items.Item index={i()}>
                      <form.items.name />
                    </form.items.Item>
                  )}
                </For>
                <button type="button" onClick={() => move(0, 2)} data-testid="move">
                  Move First to Third Position
                </button>
              </>
            )}
          </form.items>
        </form.Initialize>
      ))

      const initialInputs = screen.getAllByTestId("item-name") as Array<HTMLInputElement>
      expect(initialInputs.map((i) => i.value)).toEqual(["A", "B", "C", "D"])

      await user.click(screen.getByTestId("move"))

      await waitFor(() => {
        const movedInputs = screen.getAllByTestId("item-name") as Array<HTMLInputElement>
        expect(movedInputs.map((i) => i.value)).toEqual(["B", "C", "A", "D"])
      })
    })

    it("Item render prop provides remove function", async () => {
      const user = userEvent.setup()

      const ItemsArrayField = Field.makeArrayField("items", Schema.Struct({ name: Schema.String }))
      const formBuilder = FormBuilder.empty.addField(ItemsArrayField)

      const form = FormSolid.make(formBuilder, {
        fields: { items: { name: ItemNameInput } },
        onSubmit: () => {}
      })

      render(() => (
        <form.Initialize
          defaultValues={{ items: [{ name: "Item 1" }, { name: "Item 2" }] }}
        >
          <form.items>
            {({ items }) => (
              <For each={items()}>
                {(item, i) => (
                  <form.items.Item index={i()}>
                    {({ remove }) => (
                      <>
                        <form.items.name />
                        <button type="button" onClick={remove} data-testid={`item-remove-${i()}`}>
                          Remove
                        </button>
                      </>
                    )}
                  </form.items.Item>
                )}
              </For>
            )}
          </form.items>
        </form.Initialize>
      ))

      expect(screen.getAllByTestId("item-name")).toHaveLength(2)

      await user.click(screen.getByTestId("item-remove-0"))

      await waitFor(() => {
        expect(screen.getAllByTestId("item-name")).toHaveLength(1)
        expect((screen.getByTestId("item-name") as HTMLInputElement).value).toBe("Item 2")
      })
    })
  })

  describe("async validation", () => {
    it("submit works with async schema validation (filterEffect)", async () => {
      const user = userEvent.setup()
      const submitHandler = vi.fn()

      const AsyncEmail = Schema.String.pipe(
        Schema.filterEffect(() => Effect.succeed(true).pipe(Effect.delay("10 millis")))
      )

      const EmailField = Field.makeField("email", AsyncEmail)
      const formBuilder = FormBuilder.empty.addField(EmailField)

      const form = FormSolid.make(formBuilder, {
        fields: { email: TextInput },
        onSubmit: (_: void, { decoded }) => submitHandler(decoded)
      })

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(() => (
        <form.Initialize defaultValues={{ email: "test@example.com" }}>
          <form.email />
          <SubmitButton />
        </form.Initialize>
      ))

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(submitHandler).toHaveBeenCalledWith({ email: "test@example.com" })
      }, { timeout: 1000 })
    })

    it("exposes isValidating state during async validation", async () => {
      const user = userEvent.setup()

      const AsyncField = Schema.String.pipe(
        Schema.filterEffect(() => Effect.succeed(true).pipe(Effect.delay("100 millis")))
      )

      const ValidatingInput: FormSolid.FieldComponent<string> = (props) => (
        <div>
          <input
            type="text"
            value={props.field.value}
            onInput={(e) => props.field.onChange(e.currentTarget.value)}
            onBlur={props.field.onBlur}
            data-testid="async-input"
          />
          <span data-testid="is-validating">{String(props.field.isValidating)}</span>
        </div>
      )

      const AsyncFieldDef = Field.makeField("asyncField", AsyncField)
      const formBuilder = FormBuilder.empty.addField(AsyncFieldDef)

      const form = FormSolid.make(formBuilder, {
        fields: { asyncField: ValidatingInput },
        mode: { validation: "onBlur" },
        onSubmit: () => {}
      })

      render(() => (
        <form.Initialize defaultValues={{ asyncField: "" }}>
          <form.asyncField />
        </form.Initialize>
      ))

      expect(screen.getByTestId("is-validating")).toHaveTextContent("false")

      const input = screen.getByTestId("async-input")
      await user.type(input, "test")
      await user.tab()

      await waitFor(() => {
        expect(screen.getByTestId("is-validating")).toHaveTextContent("true")
      })

      await waitFor(() => {
        expect(screen.getByTestId("is-validating")).toHaveTextContent("false")
      }, { timeout: 500 })
    })
  })

  describe("cross-field validation", () => {
    it("FormBuilder.refine validates across fields and routes error to specific field", async () => {
      const user = userEvent.setup()

      const PasswordInput: FormSolid.FieldComponent<string> = (props) => (
        <div>
          <input
            type="password"
            value={props.field.value}
            onInput={(e) => props.field.onChange(e.currentTarget.value)}
            onBlur={props.field.onBlur}
            data-testid="password"
          />
          <Show when={Option.isSome(props.field.error)}>
            <span data-testid="password-error">{Option.getOrNull(props.field.error)}</span>
          </Show>
        </div>
      )

      const ConfirmPasswordInput: FormSolid.FieldComponent<string> = (props) => (
        <div>
          <input
            type="password"
            value={props.field.value}
            onInput={(e) => props.field.onChange(e.currentTarget.value)}
            onBlur={props.field.onBlur}
            data-testid="confirm-password"
          />
          <Show when={Option.isSome(props.field.error)}>
            <span data-testid="confirm-password-error">{Option.getOrNull(props.field.error)}</span>
          </Show>
        </div>
      )

      const PasswordField = Field.makeField("password", Schema.String)
      const ConfirmPasswordField = Field.makeField("confirmPassword", Schema.String)
      const formBuilder = FormBuilder.empty.addField(PasswordField).addField(ConfirmPasswordField)
        .refine((values) => {
          if (values.password !== values.confirmPassword) {
            return { path: ["confirmPassword"], message: "Passwords must match" }
          }
        })

      const form = FormSolid.make(formBuilder, {
        fields: {
          password: PasswordInput,
          confirmPassword: ConfirmPasswordInput
        },
        onSubmit: () => {}
      })

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(() => (
        <form.Initialize defaultValues={{ password: "secret", confirmPassword: "different" }}>
          <form.password />
          <form.confirmPassword />
          <SubmitButton />
        </form.Initialize>
      ))

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("confirm-password-error")).toHaveTextContent("Passwords must match")
      })

      expect(screen.queryByTestId("password-error")).not.toBeInTheDocument()
    })

    it("refineEffect performs async cross-field validation", async () => {
      const user = userEvent.setup()

      const UsernameInput: FormSolid.FieldComponent<string> = (props) => (
        <div>
          <input
            type="text"
            value={props.field.value}
            onInput={(e) => props.field.onChange(e.currentTarget.value)}
            onBlur={props.field.onBlur}
            data-testid="username"
          />
          <Show when={Option.isSome(props.field.error)}>
            <span data-testid="username-error">{Option.getOrNull(props.field.error)}</span>
          </Show>
        </div>
      )

      const UsernameField = Field.makeField("username", Schema.String)
      const formBuilder = FormBuilder.empty
        .addField(UsernameField)
        .refineEffect((values) =>
          Effect.gen(function*() {
            yield* Effect.sleep("20 millis")
            if (values.username === "taken") {
              return { path: ["username"], message: "Username is already taken" }
            }
          })
        )

      const form = FormSolid.make(formBuilder, {
        fields: { username: UsernameInput },
        onSubmit: () => {}
      })

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(() => (
        <form.Initialize defaultValues={{ username: "taken" }}>
          <form.username />
          <SubmitButton />
        </form.Initialize>
      ))

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("username-error")).toHaveTextContent("Username is already taken")
      }, { timeout: 200 })
    })

    it("refineEffect works with Effect services from runtime", async () => {
      const user = userEvent.setup()

      class UsernameValidator extends Context.Tag("UsernameValidator")<
        UsernameValidator,
        { readonly isTaken: (username: string) => Effect.Effect<boolean> }
      >() {}

      const UsernameValidatorLive = Layer.succeed(UsernameValidator, {
        isTaken: (username) => Effect.succeed(username === "taken")
      })

      const UsernameInput: FormSolid.FieldComponent<string> = (props) => (
        <div>
          <input
            type="text"
            value={props.field.value}
            onInput={(e) => props.field.onChange(e.currentTarget.value)}
            onBlur={props.field.onBlur}
            data-testid="username"
          />
          <Show when={Option.isSome(props.field.error)}>
            <span data-testid="username-error">{Option.getOrNull(props.field.error)}</span>
          </Show>
        </div>
      )

      const UsernameField = Field.makeField("username", Schema.String)
      const formBuilder = FormBuilder.empty
        .addField(UsernameField)
        .refineEffect((values) =>
          Effect.gen(function*() {
            const registry = yield* Registry.AtomRegistry
            expect(typeof registry.get).toBe("function")

            const validator = yield* UsernameValidator
            const isTaken = yield* validator.isTaken(values.username)
            if (isTaken) {
              return { path: ["username"], message: "Username is already taken" }
            }
          })
        )

      const runtime = Atom.runtime(UsernameValidatorLive)
      const form = FormSolid.make(formBuilder, {
        runtime,
        fields: { username: UsernameInput },
        onSubmit: () => {}
      })

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(() => (
        <form.Initialize defaultValues={{ username: "taken" }}>
          <form.username />
          <SubmitButton />
        </form.Initialize>
      ))

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("username-error")).toHaveTextContent("Username is already taken")
      })
    })

    it("multiple chained refine() calls are all executed", async () => {
      const user = userEvent.setup()

      const FieldInput: FormSolid.FieldComponent<string, { testId: string }> = (props) => (
        <div>
          <input
            type="text"
            value={props.field.value}
            onInput={(e) => props.field.onChange(e.currentTarget.value)}
            onBlur={props.field.onBlur}
            data-testid={props.props.testId}
          />
          <Show when={Option.isSome(props.field.error)}>
            <span data-testid={`${props.props.testId}-error`}>{Option.getOrNull(props.field.error)}</span>
          </Show>
        </div>
      )

      const FieldAInput: FormSolid.FieldComponent<string> = (props) => (
        <FieldInput field={props.field} props={{ testId: "fieldA" }} />
      )
      const FieldBInput: FormSolid.FieldComponent<string> = (props) => (
        <FieldInput field={props.field} props={{ testId: "fieldB" }} />
      )

      const FieldAField = Field.makeField("fieldA", Schema.String)
      const FieldBField = Field.makeField("fieldB", Schema.String)
      const formBuilder = FormBuilder.empty
        .addField(FieldAField)
        .addField(FieldBField)
        .refine((values) => {
          if (values.fieldA === "error1") {
            return { path: ["fieldA"], message: "First validation failed" }
          }
        })
        .refine((values) => {
          if (values.fieldB === "error2") {
            return { path: ["fieldB"], message: "Second validation failed" }
          }
        })

      const form = FormSolid.make(formBuilder, {
        fields: { fieldA: FieldAInput, fieldB: FieldBInput },
        onSubmit: () => {}
      })

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      const FormWrapper = (props: { key: string, values: any }) => (
        <Show when={props.key} keyed>
          <form.Initialize defaultValues={props.values}>
            <form.fieldA />
            <form.fieldB />
            <SubmitButton />
          </form.Initialize>
        </Show>
      )

      const [state, setState] = createSignal({ key: "1", values: { fieldA: "error1", fieldB: "valid" } })

      render(() => <FormWrapper key={state().key} values={state().values} />)

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("fieldA-error")).toHaveTextContent("First validation failed")
      })
      expect(screen.queryByTestId("fieldB-error")).not.toBeInTheDocument()

      setState({ key: "2", values: { fieldA: "valid", fieldB: "error2" } })

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("fieldB-error")).toHaveTextContent("Second validation failed")
      })
      expect(screen.queryByTestId("fieldA-error")).not.toBeInTheDocument()
    })

    it("cross-field error persists when typing after failed submit (still invalid)", async () => {
      const user = userEvent.setup()

      const FieldInput: FormSolid.FieldComponent<string, { testId: string }> = (props) => (
        <div>
          <input
            type="text"
            value={props.field.value}
            onInput={(e) => props.field.onChange(e.currentTarget.value)}
            onBlur={props.field.onBlur}
            data-testid={props.props.testId}
          />
          <Show when={Option.isSome(props.field.error)}>
            <span data-testid={`${props.props.testId}-error`}>{Option.getOrNull(props.field.error)}</span>
          </Show>
        </div>
      )

      const PasswordInput: FormSolid.FieldComponent<string> = (props) => (
        <FieldInput field={props.field} props={{ testId: "password" }} />
      )
      const ConfirmInput: FormSolid.FieldComponent<string> = (props) => (
        <FieldInput field={props.field} props={{ testId: "confirm" }} />
      )

      const PasswordField = Field.makeField("password", Schema.String)
      const ConfirmField = Field.makeField("confirm", Schema.String)
      const formBuilder = FormBuilder.empty
        .addField(PasswordField)
        .addField(ConfirmField)
        .refine((values) => {
          if (values.password !== values.confirm) {
            return { path: ["confirm"], message: "Passwords must match" }
          }
        })

      const form = FormSolid.make(formBuilder, {
        fields: { password: PasswordInput, confirm: ConfirmInput },
        onSubmit: () => {}
      })

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(() => (
        <form.Initialize defaultValues={{ password: "secret", confirm: "different" }}>
          <form.password />
          <form.confirm />
          <SubmitButton />
        </form.Initialize>
      ))

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("confirm-error")).toHaveTextContent("Passwords must match")
      })

      const confirmInput = screen.getByTestId("confirm")
      await user.type(confirmInput, "x")

      await new Promise((r) => setTimeout(r, 50))
      expect(screen.getByTestId("confirm-error")).toHaveTextContent("Passwords must match")
    })

    it("cross-field error clears when fixed and resubmitted", async () => {
      const user = userEvent.setup()

      const FieldInput: FormSolid.FieldComponent<string, { testId: string }> = (props) => (
        <div>
          <input
            type="text"
            value={props.field.value}
            onInput={(e) => props.field.onChange(e.currentTarget.value)}
            onBlur={props.field.onBlur}
            data-testid={props.props.testId}
          />
          <Show when={Option.isSome(props.field.error)}>
            <span data-testid={`${props.props.testId}-error`}>{Option.getOrNull(props.field.error)}</span>
          </Show>
        </div>
      )

      const PasswordInput: FormSolid.FieldComponent<string> = (props) => (
        <FieldInput field={props.field} props={{ testId: "password" }} />
      )
      const ConfirmInput: FormSolid.FieldComponent<string> = (props) => (
        <FieldInput field={props.field} props={{ testId: "confirm" }} />
      )

      const PasswordField = Field.makeField("password", Schema.String)
      const ConfirmField = Field.makeField("confirm", Schema.String)
      const formBuilder = FormBuilder.empty
        .addField(PasswordField)
        .addField(ConfirmField)
        .refine((values) => {
          if (values.password !== values.confirm) {
            return { path: ["confirm"], message: "Passwords must match" }
          }
        })

      const form = FormSolid.make(formBuilder, {
        fields: { password: PasswordInput, confirm: ConfirmInput },
        onSubmit: () => {}
      })

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(() => (
        <form.Initialize defaultValues={{ password: "secret", confirm: "different" }}>
          <form.password />
          <form.confirm />
          <SubmitButton />
        </form.Initialize>
      ))

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("confirm-error")).toHaveTextContent("Passwords must match")
      })

      const confirmInput = screen.getByTestId("confirm")
      await user.clear(confirmInput)
      await user.type(confirmInput, "secret")

      expect(screen.getByTestId("confirm-error")).toHaveTextContent("Passwords must match")

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.queryByTestId("confirm-error")).not.toBeInTheDocument()
      })
    })

    it("routes cross-field errors to nested array item fields", async () => {
      const user = userEvent.setup()

      const ItemNameInput: FormSolid.FieldComponent<string> = (props) => (
        <div>
          <input
            type="text"
            value={props.field.value}
            onInput={(e) => props.field.onChange(e.currentTarget.value)}
            onBlur={props.field.onBlur}
            data-testid="item-name"
          />
          <Show when={Option.isSome(props.field.error)}>
            <span data-testid="item-name-error">{Option.getOrNull(props.field.error)}</span>
          </Show>
        </div>
      )

      const ItemSchema = Schema.Struct({
        name: Schema.String.pipe(Schema.minLength(3, { message: () => "Name must be at least 3 characters" }))
      })

      const ItemsArrayField = Field.makeArrayField("items", ItemSchema)
      const formBuilder = FormBuilder.empty.addField(ItemsArrayField)

      const form = FormSolid.make(formBuilder, {
        fields: { items: { name: ItemNameInput } },
        onSubmit: () => {}
      })

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(() => (
        <form.Initialize defaultValues={{ items: [{ name: "AB" }] }}>
          <form.items>
            {({ items }) => (
              <>
                <For each={items()}>
                  {(item, i) => (
                    <form.items.Item index={i()}>
                      <form.items.name />
                    </form.items.Item>
                  )}
                </For>
              </>
            )}
          </form.items>
          <SubmitButton />
        </form.Initialize>
      ))

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("item-name-error")).toHaveTextContent(
          "Name must be at least 3 characters"
        )
      })
    })
  })

  describe("validation modes", () => {
    it("onSubmit mode shows errors after submit attempt", async () => {
      const user = userEvent.setup()

      const NonEmpty = Schema.String.pipe(Schema.minLength(1, { message: () => "Required" }))
      const NameField = Field.makeField("name", NonEmpty)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const form = FormSolid.make(formBuilder, {
        fields: { name: TextInput },
        mode: { validation: "onSubmit" },
        onSubmit: () => {}
      })

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(() => (
        <form.Initialize defaultValues={{ name: "" }}>
          <form.name />
          <SubmitButton />
        </form.Initialize>
      ))

      expect(screen.queryByTestId("error")).not.toBeInTheDocument()

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("Required")
      })
    })

    it("onChange mode shows errors immediately without needing blur", async () => {
      const user = userEvent.setup()

      const MinLength = Schema.String.pipe(Schema.minLength(3, { message: () => "Min 3 chars" }))
      const NameField = Field.makeField("name", MinLength)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const form = FormSolid.make(formBuilder, {
        fields: { name: TextInput },
        mode: { validation: "onChange" },
        onSubmit: () => {}
      })

      render(() => (
        <form.Initialize defaultValues={{ name: "" }}>
          <form.name />
        </form.Initialize>
      ))

      const input = screen.getByTestId("text-input")

      await user.type(input, "ab")

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("Min 3 chars")
      })

      await user.type(input, "c")

      await waitFor(() => {
        expect(screen.queryByTestId("error")).not.toBeInTheDocument()
      })
    })

    it("onSubmit mode keeps errors when typing still-invalid values after failed submit", async () => {
      const user = userEvent.setup()

      const MinLength = Schema.String.pipe(Schema.minLength(8, { message: () => "Min 8 chars" }))
      const PasswordField = Field.makeField("password", MinLength)
      const formBuilder = FormBuilder.empty.addField(PasswordField)

      const form = FormSolid.make(formBuilder, {
        fields: { password: TextInput },
        mode: { validation: "onSubmit" },
        onSubmit: () => {}
      })

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(() => (
        <form.Initialize defaultValues={{ password: "" }}>
          <form.password />
          <SubmitButton />
        </form.Initialize>
      ))

      const input = screen.getByTestId("text-input")

      await user.type(input, "short")

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("Min 8 chars")
      })

      await user.type(input, "x")

      await new Promise((r) => setTimeout(r, 50))
      expect(screen.getByTestId("error")).toHaveTextContent("Min 8 chars")
    })

    it("onSubmit mode clears errors when typing valid values after failed submit", async () => {
      const user = userEvent.setup()

      const MinLength = Schema.String.pipe(Schema.minLength(8, { message: () => "Min 8 chars" }))
      const PasswordField = Field.makeField("password", MinLength)
      const formBuilder = FormBuilder.empty.addField(PasswordField)

      const form = FormSolid.make(formBuilder, {
        fields: { password: TextInput },
        mode: { validation: "onSubmit" },
        onSubmit: () => {}
      })

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(() => (
        <form.Initialize defaultValues={{ password: "" }}>
          <form.password />
          <SubmitButton />
        </form.Initialize>
      ))

      const input = screen.getByTestId("text-input")

      await user.type(input, "short")

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("Min 8 chars")
      })

      await user.type(input, "123")

      await waitFor(() => {
        expect(screen.queryByTestId("error")).not.toBeInTheDocument()
      })
    })

    it("cross-field refinement errors persist until re-submit", async () => {
      const user = userEvent.setup()

      const PasswordField = Field.makeField("password", Schema.String.pipe(Schema.minLength(4)))
      const ConfirmField = Field.makeField("confirm", Schema.String)

      const formBuilder = FormBuilder.empty
        .addField(PasswordField)
        .addField(ConfirmField)
        .refine((values) => {
          if (values.password !== values.confirm) {
            return { path: ["confirm"], message: "Passwords must match" }
          }
        })

      const form = FormSolid.make(formBuilder, {
        fields: {
          password: TextInput,
          confirm: (props) => (
            <div>
              <input
                data-testid="confirm-input"
                type="text"
                value={props.field.value}
                onInput={(e) => props.field.onChange(e.currentTarget.value)}
                onBlur={props.field.onBlur}
              />
              <Show when={Option.isSome(props.field.error)}>
                <span data-testid="confirm-error">{Option.getOrNull(props.field.error)}</span>
              </Show>
            </div>
          )
        },
        mode: { validation: "onSubmit" },
        onSubmit: () => {}
      })

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(() => (
        <form.Initialize defaultValues={{ password: "test", confirm: "different" }}>
          <form.password />
          <form.confirm />
          <SubmitButton />
        </form.Initialize>
      ))

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("confirm-error")).toHaveTextContent("Passwords must match")
      })

      await user.clear(screen.getByTestId("confirm-input"))
      await user.type(screen.getByTestId("confirm-input"), "test")

      await new Promise((r) => setTimeout(r, 100))

      // Refinement errors persist until re-submit
      expect(screen.getByTestId("confirm-error")).toHaveTextContent("Passwords must match")

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.queryByTestId("confirm-error")).not.toBeInTheDocument()
      })
    })

    it("per-field errors clear on valid input while refinement errors persist", async () => {
      const user = userEvent.setup()

      const PasswordField = Field.makeField(
        "password",
        Schema.String.pipe(Schema.minLength(8, { message: () => "Min 8 chars" }))
      )
      const ConfirmField = Field.makeField("confirm", Schema.String)

      const formBuilder = FormBuilder.empty
        .addField(PasswordField)
        .addField(ConfirmField)
        .refine((values) => {
          if (values.password !== values.confirm) {
            return { path: ["confirm"], message: "Must match password" }
          }
        })

      const form = FormSolid.make(formBuilder, {
        fields: {
          password: TextInput,
          confirm: (props) => (
            <div>
              <input
                data-testid="confirm-input"
                type="text"
                value={props.field.value}
                onInput={(e) => props.field.onChange(e.currentTarget.value)}
                onBlur={props.field.onBlur}
              />
              <Show when={Option.isSome(props.field.error)}>
                <span data-testid="confirm-error">{Option.getOrNull(props.field.error)}</span>
              </Show>
            </div>
          )
        },
        mode: { validation: "onSubmit" },
        onSubmit: () => {}
      })

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(() => (
        <form.Initialize defaultValues={{ password: "short", confirm: "different" }}>
          <form.password />
          <form.confirm />
          <SubmitButton />
        </form.Initialize>
      ))

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("Min 8 chars")
      })

      await user.type(screen.getByTestId("text-input"), "1234")

      await waitFor(() => {
        expect(screen.queryByTestId("error")).not.toBeInTheDocument()
      })

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("confirm-error")).toHaveTextContent("Must match password")
      })

      await user.clear(screen.getByTestId("confirm-input"))
      await user.type(screen.getByTestId("confirm-input"), "short1234")

      await new Promise((r) => setTimeout(r, 100))

      // Refinement errors persist until re-submit
      expect(screen.getByTestId("confirm-error")).toHaveTextContent("Must match password")

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.queryByTestId("confirm-error")).not.toBeInTheDocument()
      })
    })

    it("hides stored field error while async validation is pending (async gap)", async () => {
      const user = userEvent.setup()

      const AsyncMinLength = Schema.String.pipe(
        Schema.minLength(8, { message: () => "Too short" }),
        Schema.filterEffect((_value) =>
          Effect.gen(function*() {
            yield* Effect.sleep("200 millis")
            return undefined
          })
        )
      )
      const PasswordField = Field.makeField("password", AsyncMinLength)
      const formBuilder = FormBuilder.empty.addField(PasswordField)

      const form = FormSolid.make(formBuilder, {
        fields: { password: TextInput },
        mode: { validation: "onSubmit" },
        onSubmit: () => {}
      })

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(() => (
        <form.Initialize defaultValues={{ password: "short" }}>
          <form.password />
          <SubmitButton />
        </form.Initialize>
      ))

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("Too short")
      })

      await user.type(screen.getByTestId("text-input"), "1234567")

      // Stored field error hidden while async validation pending (isValidating = true)
      await waitFor(() => {
        expect(screen.queryByTestId("error")).not.toBeInTheDocument()
      })
    })

    it("persists refinement errors across field unmount/remount", async () => {
      const user = userEvent.setup()

      const PasswordField = Field.makeField("password", Schema.String)
      const ConfirmField = Field.makeField("confirm", Schema.String)

      const formBuilder = FormBuilder.empty
        .addField(PasswordField)
        .addField(ConfirmField)
        .refine((values) => {
          if (values.password !== values.confirm) {
            return { path: ["confirm"], message: "Passwords must match" }
          }
        })

      const form = FormSolid.make(formBuilder, {
        fields: {
          password: TextInput,
          confirm: (props) => (
            <div>
              <input
                data-testid="confirm-input"
                type="text"
                value={props.field.value}
                onInput={(e) => props.field.onChange(e.currentTarget.value)}
                onBlur={props.field.onBlur}
              />
              <Show when={Option.isSome(props.field.error)}>
                <span data-testid="confirm-error">{Option.getOrNull(props.field.error)}</span>
              </Show>
            </div>
          )
        },
        mode: { validation: "onSubmit" },
        onSubmit: () => {}
      })

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      const ToggleableForm = () => {
        const [showConfirm, setShowConfirm] = createSignal(true)
        return (
          <form.Initialize defaultValues={{ password: "abc", confirm: "xyz" }}>
            <form.password />
            <Show when={showConfirm()}>
              <form.confirm />
            </Show>
            <button data-testid="toggle" onClick={() => setShowConfirm((v) => !v)}>
              Toggle
            </button>
            <SubmitButton />
          </form.Initialize>
        )
      }

      render(() => <ToggleableForm />)

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("confirm-error")).toHaveTextContent("Passwords must match")
      })

      await user.click(screen.getByTestId("toggle"))
      expect(screen.queryByTestId("confirm-input")).not.toBeInTheDocument()

      await user.click(screen.getByTestId("toggle"))
      expect(screen.getByTestId("confirm-input")).toBeInTheDocument()

      // Error persists across unmount/remount (stored in atoms, not component state)
      expect(screen.getByTestId("confirm-error")).toHaveTextContent("Passwords must match")
    })
  })

  describe("error handling", () => {
    it("captures error when onSubmit Effect fails", async () => {
      const user = userEvent.setup()

      const NameField = Field.makeField("name", Schema.String)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const onSubmit = () => Effect.fail(new Error("Submission failed"))

      const form = FormSolid.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit
      })

      const SubmitResultDisplay = () => {
        const submitResult = useAtomValue(form.submit)
        return (
          <>
            <span data-testid="result-tag">{submitResult()._tag}</span>
            <span data-testid="result-waiting">{String(submitResult().waiting)}</span>
          </>
        )
      }

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(() => (
        <form.Initialize defaultValues={{ name: "test" }}>
          <form.name />
          <SubmitButton />
          <SubmitResultDisplay />
        </form.Initialize>
      ))

      expect(screen.getByTestId("result-tag")).toHaveTextContent("Initial")

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("result-tag")).toHaveTextContent("Failure")
        expect(screen.getByTestId("result-waiting")).toHaveTextContent("false")
      })
    })
  })

  describe("form atoms", () => {
    it("exposes submitResult with initial state", () => {
      const NameField = Field.makeField("name", Schema.String)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const onSubmit = () => {}

      const form = FormSolid.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit
      })

      let capturedIsDirty: boolean | undefined
      let capturedSubmitResult: Result.Result<unknown, unknown> | undefined

      const Consumer = () => {
        useAtomSubscribe(form.isDirty, (v) => {
          capturedIsDirty = v
        }, { immediate: true })
        useAtomSubscribe(form.submit, (v) => {
          capturedSubmitResult = v
        }, { immediate: true })
        return null
      }

      render(() => (
        <form.Initialize defaultValues={{ name: "test" }}>
          <form.name />
          <Consumer />
        </form.Initialize>
      ))

      expect(capturedIsDirty).toBe(false)
      expect(Result.isInitial(capturedSubmitResult!)).toBe(true)
    })

    it("exposes submitResult.waiting during submission", async () => {
      const user = userEvent.setup()

      const NameField = Field.makeField("name", Schema.String)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const onSubmit = () => Effect.void.pipe(Effect.delay("50 millis"))

      const form = FormSolid.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit
      })

      const states: Array<{ waiting: boolean; tag: string }> = []

      const Consumer = () => {
        const submitResult = useAtomValue(form.submit)
        createEffect(() => {
          states.push({ waiting: submitResult().waiting, tag: submitResult()._tag })
        })
        return null
      }

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(() => (
        <form.Initialize defaultValues={{ name: "test" }}>
          <form.name />
          <SubmitButton />
          <Consumer />
        </form.Initialize>
      ))

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(states.some((s) => s.waiting)).toBe(true)
      })

      await waitFor(() => {
        const lastState = states[states.length - 1]
        expect(lastState.tag).toBe("Success")
        expect(lastState.waiting).toBe(false)
      }, { timeout: 1000 })
    })

    it("exposes submitResult with failure on validation error", async () => {
      const user = userEvent.setup()

      const NonEmpty = Schema.String.pipe(Schema.minLength(1, { message: () => "Required" }))
      const NameField = Field.makeField("name", NonEmpty)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const onSubmit = () => {}

      const form = FormSolid.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit
      })

      let capturedResult: Result.Result<unknown, unknown> | undefined

      const Consumer = () => {
        useAtomSubscribe(form.submit, (v) => {
          capturedResult = v
        }, { immediate: true })
        return null
      }

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(() => (
        <form.Initialize defaultValues={{ name: "" }}>
          <form.name />
          <SubmitButton />
          <Consumer />
        </form.Initialize>
      ))

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(capturedResult).toBeDefined()
        expect(Result.isFailure(capturedResult!)).toBe(true)
      })
    })

    it("updates isDirty when values change", async () => {
      const user = userEvent.setup()

      const NameField = Field.makeField("name", Schema.String)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const onSubmit = () => {}

      const form = FormSolid.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit
      })

      const dirtyStates: Array<boolean> = []

      const Consumer = () => {
        const isDirty = useAtomValue(form.isDirty)
        createEffect(() => {
            dirtyStates.push(isDirty())
        })
        return null
      }

      render(() => (
        <form.Initialize defaultValues={{ name: "initial" }}>
          <form.name />
          <Consumer />
        </form.Initialize>
      ))

      expect(dirtyStates[dirtyStates.length - 1]).toBe(false)

      const input = screen.getByTestId("text-input")
      await user.clear(input)
      await user.type(input, "changed")

      await waitFor(() => {
        expect(dirtyStates[dirtyStates.length - 1]).toBe(true)
      })
    })
  })

  describe("isDirty lifecycle", () => {
    it("form reinitializes when using Show keyed to force remount", async () => {
      const user = userEvent.setup()
      const NameField = Field.makeField("name", Schema.String)
      const formBuilder = FormBuilder.empty.addField(NameField)
      const form = FormSolid.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit: () => {}
      })

      let isDirty: boolean | undefined

      const TestComponent = () => {
        useAtomSubscribe(form.isDirty, (v) => {
          isDirty = v
        }, { immediate: true })
        return null
      }

      const FormWrapper = () => {
        const [key, setKey] = createSignal(1)
        const [defaultName, setDefaultName] = createSignal("initial")

        const remount = () => {
             setDefaultName("new-initial")
             setKey(2)
        }

        return (
            <>
                <Show when={key()} keyed>
                    <form.Initialize defaultValues={{ name: defaultName() }}>
                        <form.name />
                        <TestComponent />
                    </form.Initialize>
                </Show>
                <button onClick={remount} data-testid="remount">Remount</button>
            </>
        )
      }

      render(() => <FormWrapper />)

      expect(isDirty).toBe(false)

      const input = screen.getByTestId("text-input")
      await user.clear(input)
      await user.type(input, "modified")

      expect(isDirty).toBe(true)

      await user.click(screen.getByTestId("remount"))

      await waitFor(() => {
        expect(screen.getByTestId("text-input")).toHaveValue("new-initial")
        expect(isDirty).toBe(false)
      })
    })

    it("key-change remount with parent subscription does not render stale values", async () => {
      const NameField = Field.makeField("name", Schema.String)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const form = FormSolid.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit: () => {}
      })

      const renderedValues: Array<string> = []

      const ValueTracker = () => {
        const values = useAtomValue(form.values)
        createEffect(() => {
            const val = values()
            if (Option.isSome(val)) {
                renderedValues.push(val.value.name as string)
            }
        })
        return null
      }

      const Parent = (props: { variantId: string; defaultName: string }) => {
        useAtomValue(form.values)
        return (
          <Show when={props.variantId} keyed>
            <form.Initialize defaultValues={{ name: props.defaultName }}>
                <form.name />
                <ValueTracker />
            </form.Initialize>
          </Show>
        )
      }

      const [state, setState] = createSignal({ variantId: "1", defaultName: "alice" })

      render(() => <Parent variantId={state().variantId} defaultName={state().defaultName} />)

      await waitFor(() => {
        expect(screen.getByTestId("text-input")).toHaveValue("alice")
      })

      renderedValues.length = 0

      setState({ variantId: "2", defaultName: "bob" })

      await waitFor(() => {
        expect(screen.getByTestId("text-input")).toHaveValue("bob")
      })

      expect(renderedValues.every((v) => v === "bob")).toBe(true)
    })

    it("isDirty becomes false when value returns to initial", async () => {
      const user = userEvent.setup()

      const NameField = Field.makeField("name", Schema.String)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const onSubmit = () => {}

      const form = FormSolid.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit
      })

      let isDirty: boolean | undefined

      const TestComponent = () => {
        useAtomSubscribe(form.isDirty, (v) => {
          isDirty = v
        }, { immediate: true })
        return null
      }

      render(() => (
        <form.Initialize defaultValues={{ name: "initial" }}>
          <form.name />
          <TestComponent />
        </form.Initialize>
      ))

      expect(isDirty).toBe(false)

      const input = screen.getByTestId("text-input")
      await user.clear(input)
      await user.type(input, "changed")
      expect(isDirty).toBe(true)

      await user.clear(input)
      await user.type(input, "initial")
      expect(isDirty).toBe(false)
    })

    it("isDirty remains after successful submission", async () => {
      const user = userEvent.setup()

      const NameField = Field.makeField("name", Schema.String)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const onSubmit = () => {}

      const form = FormSolid.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit
      })

      const TestComponent = () => {
        const isDirty = useAtomValue(form.isDirty)
        const submit = useAtomSet(form.submit)
        return (
          <>
            <span data-testid="isDirty">{String(isDirty())}</span>
            <button onClick={() => submit()} data-testid="submit">Submit</button>
          </>
        )
      }

      render(() => (
        <form.Initialize defaultValues={{ name: "initial" }}>
          <form.name />
          <TestComponent />
        </form.Initialize>
      ))

      const input = screen.getByTestId("text-input")
      await user.clear(input)
      await user.type(input, "changed")
      expect(screen.getByTestId("isDirty")).toHaveTextContent("true")

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("isDirty")).toHaveTextContent("true")
      })
    })

    it("reset() restores form to initial values", async () => {
      const user = userEvent.setup()

      const NameField = Field.makeField("name", Schema.String)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const onSubmit = () => {}

      const form = FormSolid.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit
      })

      const TestComponent = () => {
        const isDirty = useAtomValue(form.isDirty)
        const submitResult = useAtomValue(form.submit)
        const submit = useAtomSet(form.submit)
        const reset = useAtomSet(form.reset)
        return (
          <>
            <span data-testid="isDirty">{String(isDirty())}</span>
            <span data-testid="submitResultTag">{submitResult()._tag}</span>
            <button onClick={() => submit()} data-testid="submit">Submit</button>
            <button onClick={() => reset()} data-testid="reset">Reset</button>
          </>
        )
      }

      render(() => (
        <form.Initialize defaultValues={{ name: "initial" }}>
          <form.name />
          <TestComponent />
        </form.Initialize>
      ))

      expect(screen.getByTestId("isDirty")).toHaveTextContent("false")
      expect(screen.getByTestId("submitResultTag")).toHaveTextContent("Initial")

      const input = screen.getByTestId("text-input")
      await user.clear(input)
      await user.type(input, "modified")
      expect(screen.getByTestId("isDirty")).toHaveTextContent("true")
      expect(screen.getByTestId("text-input")).toHaveValue("modified")

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("submitResultTag")).toHaveTextContent("Success")
      })

      await user.click(screen.getByTestId("reset"))

      await waitFor(() => {
        expect(screen.getByTestId("text-input")).toHaveValue("initial")
        expect(screen.getByTestId("isDirty")).toHaveTextContent("false")
        expect(screen.getByTestId("submitResultTag")).toHaveTextContent("Initial")
      })
    })
  })

  describe("reactivity", () => {
    it("reactivityKeys triggers invalidation after successful submit", async () => {
      const user = userEvent.setup()

      let rebuilds = 0
      const counterAtom = Atom.make(() => rebuilds++).pipe(
        Atom.withReactivity(["form-submit"]),
        Atom.keepAlive
      )

      const NameField = Field.makeField("name", Schema.String)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const form = FormSolid.make(formBuilder, {
        fields: { name: TextInput },
        reactivityKeys: ["form-submit"],
        onSubmit: () => {}
      })

      const CounterDisplay = () => {
        const count = useAtomValue(counterAtom)
        return <span data-testid="rebuild-count">{count()}</span>
      }

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(() => (
        <form.Initialize defaultValues={{ name: "test" }}>
          <form.name />
          <SubmitButton />
          <CounterDisplay />
        </form.Initialize>
      ))

      await waitFor(() => {
        expect(screen.getByTestId("rebuild-count")).toHaveTextContent("0")
      })

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("rebuild-count")).toHaveTextContent("1")
      })
    })

    it("no invalidation when reactivityKeys is not provided", async () => {
      const user = userEvent.setup()
      const submitHandler = vi.fn()

      let rebuilds = 0
      const counterAtom = Atom.make(() => rebuilds++).pipe(
        Atom.withReactivity(["no-keys-test"]),
        Atom.keepAlive
      )

      const NameField = Field.makeField("name", Schema.String)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const form = FormSolid.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit: () => submitHandler()
      })

      const CounterDisplay = () => {
        const count = useAtomValue(counterAtom)
        return <span data-testid="rebuild-count">{count()}</span>
      }

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(() => (
        <form.Initialize defaultValues={{ name: "test" }}>
          <form.name />
          <SubmitButton />
          <CounterDisplay />
        </form.Initialize>
      ))

      await waitFor(() => {
        expect(screen.getByTestId("rebuild-count")).toHaveTextContent("0")
      })

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(submitHandler).toHaveBeenCalled()
      })

      expect(screen.getByTestId("rebuild-count")).toHaveTextContent("0")
    })

    it("no invalidation on validation failure", async () => {
      const user = userEvent.setup()

      let rebuilds = 0
      const counterAtom = Atom.make(() => rebuilds++).pipe(
        Atom.withReactivity(["validation-fail-test"]),
        Atom.keepAlive
      )

      const NonEmpty = Schema.String.pipe(Schema.minLength(1, { message: () => "Required" }))
      const NameField = Field.makeField("name", NonEmpty)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const form = FormSolid.make(formBuilder, {
        fields: { name: TextInput },
        reactivityKeys: ["validation-fail-test"],
        onSubmit: () => {}
      })

      const CounterDisplay = () => {
        const count = useAtomValue(counterAtom)
        return <span data-testid="rebuild-count">{count()}</span>
      }

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(() => (
        <form.Initialize defaultValues={{ name: "" }}>
          <form.name />
          <SubmitButton />
          <CounterDisplay />
        </form.Initialize>
      ))

      await waitFor(() => {
        expect(screen.getByTestId("rebuild-count")).toHaveTextContent("0")
      })

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("Required")
      })

      expect(screen.getByTestId("rebuild-count")).toHaveTextContent("0")
    })
  })

  describe("runtime optionality", () => {
      it("does not require runtime when R is only AtomRegistry", () => {
        const NameField = Field.makeField(
          "name",
          Schema.String.pipe(
            Schema.filterEffect(() =>
              Effect.gen(function*() {
                yield* Registry.AtomRegistry
                return true as const
              })
            )
          )
        )
        const formBuilder = FormBuilder.empty.addField(NameField)
  
        const form = FormSolid.make(formBuilder, {
          fields: { name: TextInput },
          onSubmit: () => {}
        })
  
        expectTypeOf(form).not.toBeAny()
        expectTypeOf(form.submit).not.toBeAny()
        expectTypeOf(form.Initialize).not.toBeAny()
      })
    })
})
