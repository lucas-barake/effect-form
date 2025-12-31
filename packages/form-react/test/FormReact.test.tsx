import { useAtomSet, useAtomSubscribe, useAtomValue } from "@effect-atom/atom-react"
import * as Atom from "@effect-atom/atom/Atom"
import * as Registry from "@effect-atom/atom/Registry"
import * as Result from "@effect-atom/atom/Result"
import { Field, FormBuilder, FormReact } from "@lucas-barake/effect-form-react"
import { render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

const TextInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({ field }) => (
  <div>
    <input
      type="text"
      value={field.value}
      onChange={(e) => field.onChange(e.target.value)}
      onBlur={field.onBlur}
      data-testid="text-input"
    />
    {Option.isSome(field.error) && <span data-testid="error">{field.error.value}</span>}
  </div>
)

const makeSubmitButton = <A,>(submitAtom: Atom.AtomResultFn<A, unknown, unknown>, args: A) => {
  const SubmitButton = () => {
    const submit = useAtomSet(submitAtom)
    return <button onClick={() => submit(args)} data-testid="submit">Submit</button>
  }
  return SubmitButton
}

describe("FormReact.make", () => {
  describe("Initialize Component", () => {
    it("initializes with default values", () => {
      const NameField = Field.makeField("name", Schema.String)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const onSubmit = () => {}

      const form = FormReact.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit,
      })

      render(
        <form.Initialize defaultValues={{ name: "John" }}>
          <form.name />
        </form.Initialize>,
      )

      expect(screen.getByTestId("text-input")).toHaveValue("John")
    })
  })

  describe("Field Component", () => {
    it("updates value on change", async () => {
      const user = userEvent.setup()

      const NameField = Field.makeField("name", Schema.String)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const onSubmit = () => {}

      const form = FormReact.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit,
      })

      render(
        <form.Initialize defaultValues={{ name: "" }}>
          <form.name />
        </form.Initialize>,
      )

      const input = screen.getByTestId("text-input")
      await user.type(input, "Jane")

      expect(input).toHaveValue("Jane")
    })

    it("shows validation error after touch (onBlur mode)", async () => {
      const user = userEvent.setup()

      const NonEmpty = Schema.String.pipe(Schema.minLength(1, { message: () => "Required" }))
      const NameField = Field.makeField("name", NonEmpty)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const onSubmit = () => {}

      const form = FormReact.make(formBuilder, {
        fields: { name: TextInput },
        mode: "onBlur",
        onSubmit,
      })

      render(
        <form.Initialize defaultValues={{ name: "" }}>
          <form.name />
        </form.Initialize>,
      )

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

      const onSubmit = () => {}

      const form = FormReact.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit,
      })

      let isDirty: boolean | undefined

      const TestComponent = () => {
        useAtomSubscribe(form.isDirty, (dirty) => {
          isDirty = dirty
        }, { immediate: true })
        return null
      }

      render(
        <form.Initialize defaultValues={{ name: "test" }}>
          <form.name />
          <TestComponent />
        </form.Initialize>,
      )

      expect(isDirty).toBe(false)
    })

    it("returns isDirty = true when values differ from initial", async () => {
      const user = userEvent.setup()

      const NameField = Field.makeField("name", Schema.String)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const onSubmit = () => {}

      const form = FormReact.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit,
      })

      let isDirty: boolean | undefined

      const TestComponent = () => {
        useAtomSubscribe(form.isDirty, (dirty) => {
          isDirty = dirty
        }, { immediate: true })
        return null
      }

      render(
        <form.Initialize defaultValues={{ name: "" }}>
          <form.name />
          <TestComponent />
        </form.Initialize>,
      )

      const input = screen.getByTestId("text-input")
      await user.type(input, "changed")

      expect(isDirty).toBe(true)
    })

    it("submit calls onSubmit with decoded values", async () => {
      const user = userEvent.setup()
      const submitHandler = vi.fn()

      const NameField = Field.makeField("name", Schema.String)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const form = FormReact.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit: (_: void, { decoded }) => submitHandler(decoded),
      })

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(
        <form.Initialize defaultValues={{ name: "John" }}>
          <form.name />
          <SubmitButton />
        </form.Initialize>,
      )

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(submitHandler).toHaveBeenCalledWith({ name: "John" })
      })
    })
  })

  describe("multiple fields", () => {
    it("renders multiple fields correctly", async () => {
      const user = userEvent.setup()

      const FirstNameField = Field.makeField("firstName", Schema.String)
      const LastNameField = Field.makeField("lastName", Schema.String)
      const formBuilder = FormBuilder.empty.addField(FirstNameField).addField(LastNameField)

      const NamedInput: React.FC<
        FormReact.FieldComponentProps<typeof Schema.String, { name: string }>
      > = ({ field, props }) => (
        <input
          type="text"
          value={field.value}
          onChange={(e) => field.onChange(e.target.value)}
          onBlur={field.onBlur}
          data-testid={props.name}
        />
      )

      const FirstNameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({ field }) => (
        <NamedInput field={field} props={{ name: "firstName" }} />
      )

      const LastNameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({ field }) => (
        <NamedInput field={field} props={{ name: "lastName" }} />
      )

      const onSubmit = () => {}

      const form = FormReact.make(formBuilder, {
        fields: {
          firstName: FirstNameInput,
          lastName: LastNameInput,
        },
        onSubmit,
      })

      render(
        <form.Initialize defaultValues={{ firstName: "", lastName: "" }}>
          <form.firstName />
          <form.lastName />
        </form.Initialize>,
      )

      await user.type(screen.getByTestId("firstName"), "John")
      await user.type(screen.getByTestId("lastName"), "Doe")

      expect(screen.getByTestId("firstName")).toHaveValue("John")
      expect(screen.getByTestId("lastName")).toHaveValue("Doe")
    })
  })

  describe("array fields", () => {
    it("renders array field with items", async () => {
      const user = userEvent.setup()

      const TitleField = Field.makeField("title", Schema.String)
      const ItemsArrayField = Field.makeArrayField("items", Schema.Struct({ name: Schema.String }))
      const formBuilder = FormBuilder.empty.addField(TitleField).addField(ItemsArrayField)

      const TitleInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({ field }) => (
        <input
          type="text"
          value={field.value}
          onChange={(e) => field.onChange(e.target.value)}
          onBlur={field.onBlur}
          data-testid="title"
        />
      )

      const ItemNameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({ field }) => (
        <input
          type="text"
          value={field.value}
          onChange={(e) => field.onChange(e.target.value)}
          onBlur={field.onBlur}
          data-testid="item-name"
        />
      )

      const onSubmit = () => {}

      const form = FormReact.make(formBuilder, {
        fields: {
          title: TitleInput,
          items: { name: ItemNameInput },
        },
        onSubmit,
      })

      render(
        <form.Initialize
          defaultValues={{ title: "My List", items: [{ name: "Item 1" }] }}
        >
          <form.title />
          <form.items>
            {({ append, items }) => (
              <>
                {items.map((_, i) => (
                  <form.items.Item key={i} index={i}>
                    <form.items.name />
                  </form.items.Item>
                ))}
                <button type="button" onClick={() => append()} data-testid="add">
                  Add
                </button>
              </>
            )}
          </form.items>
        </form.Initialize>,
      )

      expect(screen.getByTestId("title")).toHaveValue("My List")
      expect(screen.getByTestId("item-name")).toHaveValue("Item 1")

      await user.click(screen.getByTestId("add"))

      await waitFor(() => {
        expect(screen.getAllByTestId("item-name")).toHaveLength(2)
      })
    })

    it("remove() removes item at specified index", async () => {
      const user = userEvent.setup()

      const ItemsArrayField = Field.makeArrayField("items", Schema.Struct({ name: Schema.String }))
      const formBuilder = FormBuilder.empty.addField(ItemsArrayField)

      const ItemNameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({ field }) => (
        <input
          type="text"
          value={field.value}
          onChange={(e) => field.onChange(e.target.value)}
          onBlur={field.onBlur}
          data-testid="item-name"
        />
      )

      const onSubmit = () => {}

      const form = FormReact.make(formBuilder, {
        fields: { items: { name: ItemNameInput } },
        onSubmit,
      })

      render(
        <form.Initialize
          defaultValues={{ items: [{ name: "A" }, { name: "B" }, { name: "C" }] }}
        >
          <form.items>
            {({ items, remove }) => (
              <>
                {items.map((_, i) => (
                  <div key={i} data-testid={`item-${i}`}>
                    <form.items.Item index={i}>
                      <form.items.name />
                    </form.items.Item>
                    <button type="button" onClick={() => remove(i)} data-testid={`remove-${i}`}>
                      Remove
                    </button>
                  </div>
                ))}
              </>
            )}
          </form.items>
        </form.Initialize>,
      )

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

      const ItemNameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({ field }) => (
        <input
          type="text"
          value={field.value}
          onChange={(e) => field.onChange(e.target.value)}
          onBlur={field.onBlur}
          data-testid="item-name"
        />
      )

      const onSubmit = () => {}

      const form = FormReact.make(formBuilder, {
        fields: { items: { name: ItemNameInput } },
        onSubmit,
      })

      render(
        <form.Initialize
          defaultValues={{ items: [{ name: "First" }, { name: "Second" }, { name: "Third" }] }}
        >
          <form.items>
            {({ items, swap }) => (
              <>
                {items.map((_, i) => (
                  <form.items.Item key={i} index={i}>
                    <form.items.name />
                  </form.items.Item>
                ))}
                <button type="button" onClick={() => swap(0, 2)} data-testid="swap">
                  Swap First and Third
                </button>
              </>
            )}
          </form.items>
        </form.Initialize>,
      )

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

      const ItemNameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({ field }) => (
        <input
          type="text"
          value={field.value}
          onChange={(e) => field.onChange(e.target.value)}
          onBlur={field.onBlur}
          data-testid="item-name"
        />
      )

      const onSubmit = () => {}

      const form = FormReact.make(formBuilder, {
        fields: { items: { name: ItemNameInput } },
        onSubmit,
      })

      render(
        <form.Initialize
          defaultValues={{ items: [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }] }}
        >
          <form.items>
            {({ items, move }) => (
              <>
                {items.map((_, i) => (
                  <form.items.Item key={i} index={i}>
                    <form.items.name />
                  </form.items.Item>
                ))}
                <button type="button" onClick={() => move(0, 2)} data-testid="move">
                  Move First to Third Position
                </button>
              </>
            )}
          </form.items>
        </form.Initialize>,
      )

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

      const ItemNameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({ field }) => (
        <input
          type="text"
          value={field.value}
          onChange={(e) => field.onChange(e.target.value)}
          onBlur={field.onBlur}
          data-testid="item-name"
        />
      )

      const onSubmit = () => {}

      const form = FormReact.make(formBuilder, {
        fields: { items: { name: ItemNameInput } },
        onSubmit,
      })

      render(
        <form.Initialize
          defaultValues={{ items: [{ name: "Item 1" }, { name: "Item 2" }] }}
        >
          <form.items>
            {({ items }) => (
              <>
                {items.map((_, i) => (
                  <form.items.Item key={i} index={i}>
                    {({ remove }) => (
                      <>
                        <form.items.name />
                        <button type="button" onClick={remove} data-testid={`item-remove-${i}`}>
                          Remove
                        </button>
                      </>
                    )}
                  </form.items.Item>
                ))}
              </>
            )}
          </form.items>
        </form.Initialize>,
      )

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
        Schema.filterEffect(() => Effect.succeed(true).pipe(Effect.delay("10 millis"))),
      )

      const EmailField = Field.makeField("email", AsyncEmail)
      const formBuilder = FormBuilder.empty.addField(EmailField)

      const form = FormReact.make(formBuilder, {
        fields: { email: TextInput },
        onSubmit: (_: void, { decoded }) => submitHandler(decoded),
      })

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(
        <form.Initialize defaultValues={{ email: "test@example.com" }}>
          <form.email />
          <SubmitButton />
        </form.Initialize>,
      )

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(submitHandler).toHaveBeenCalledWith({ email: "test@example.com" })
      }, { timeout: 1000 })
    })

    it("exposes isValidating state during async validation", async () => {
      const user = userEvent.setup()

      const AsyncField = Schema.String.pipe(
        Schema.filterEffect(() => Effect.succeed(true).pipe(Effect.delay("100 millis"))),
      )

      const ValidatingInput: React.FC<FormReact.FieldComponentProps<typeof AsyncField>> = ({ field }) => (
        <div>
          <input
            type="text"
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            onBlur={field.onBlur}
            data-testid="async-input"
          />
          <span data-testid="is-validating">{String(field.isValidating)}</span>
        </div>
      )

      const AsyncFieldDef = Field.makeField("asyncField", AsyncField)
      const formBuilder = FormBuilder.empty.addField(AsyncFieldDef)

      const onSubmit = () => {}

      const form = FormReact.make(formBuilder, {
        fields: { asyncField: ValidatingInput },
        mode: "onBlur",
        onSubmit,
      })

      render(
        <form.Initialize defaultValues={{ asyncField: "" }}>
          <form.asyncField />
        </form.Initialize>,
      )

      expect(screen.getByTestId("is-validating")).toHaveTextContent("false")

      const input = screen.getByTestId("async-input")
      await user.type(input, "test")
      await user.tab()

      await waitFor(() => {
        expect(screen.getByTestId("is-validating")).toHaveTextContent("true")
      })

      await waitFor(() => {
        expect(screen.getByTestId("is-validating")).toHaveTextContent("false")
      }, { timeout: 200 })
    })
  })

  describe("cross-field validation", () => {
    it("FormBuilder.refine validates across fields and routes error to specific field", async () => {
      const user = userEvent.setup()

      const PasswordInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({ field }) => (
        <div>
          <input
            type="password"
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            onBlur={field.onBlur}
            data-testid="password"
          />
          {Option.isSome(field.error) && <span data-testid="password-error">{field.error.value}</span>}
        </div>
      )

      const ConfirmPasswordInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({ field }) => (
        <div>
          <input
            type="password"
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            onBlur={field.onBlur}
            data-testid="confirm-password"
          />
          {Option.isSome(field.error) && <span data-testid="confirm-password-error">{field.error.value}</span>}
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

      const onSubmit = () => {}

      const form = FormReact.make(formBuilder, {
        fields: {
          password: PasswordInput,
          confirmPassword: ConfirmPasswordInput,
        },
        onSubmit,
      })

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(
        <form.Initialize defaultValues={{ password: "secret", confirmPassword: "different" }}>
          <form.password />
          <form.confirmPassword />
          <SubmitButton />
        </form.Initialize>,
      )

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("confirm-password-error")).toHaveTextContent("Passwords must match")
      })

      expect(screen.queryByTestId("password-error")).not.toBeInTheDocument()
    })

    it("refineEffect performs async cross-field validation", async () => {
      const user = userEvent.setup()

      const UsernameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({ field }) => (
        <div>
          <input
            type="text"
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            onBlur={field.onBlur}
            data-testid="username"
          />
          {Option.isSome(field.error) && <span data-testid="username-error">{field.error.value}</span>}
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

      const onSubmit = () => {}

      const form = FormReact.make(formBuilder, {
        fields: { username: UsernameInput },
        onSubmit,
      })

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(
        <form.Initialize defaultValues={{ username: "taken" }}>
          <form.username />
          <SubmitButton />
        </form.Initialize>,
      )

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
        isTaken: (username) => Effect.succeed(username === "taken"),
      })

      const UsernameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({ field }) => (
        <div>
          <input
            type="text"
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            onBlur={field.onBlur}
            data-testid="username"
          />
          {Option.isSome(field.error) && <span data-testid="username-error">{field.error.value}</span>}
        </div>
      )

      const UsernameField = Field.makeField("username", Schema.String)
      const formBuilder = FormBuilder.empty
        .addField(UsernameField)
        .refineEffect((values) =>
          Effect.gen(function*() {
            // AtomRegistry is auto-provided by runtime, so this should work
            const registry = yield* Registry.AtomRegistry
            expect(typeof registry.get).toBe("function")

            const validator = yield* UsernameValidator
            const isTaken = yield* validator.isTaken(values.username)
            if (isTaken) {
              return { path: ["username"], message: "Username is already taken" }
            }
          })
        )

      const onSubmit = () => {}

      const runtime = Atom.runtime(UsernameValidatorLive)
      const form = FormReact.make(formBuilder, {
        runtime,
        fields: { username: UsernameInput },
        onSubmit,
      })

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(
        <form.Initialize defaultValues={{ username: "taken" }}>
          <form.username />
          <SubmitButton />
        </form.Initialize>,
      )

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("username-error")).toHaveTextContent("Username is already taken")
      })
    })

    it("multiple chained refine() calls are all executed", async () => {
      const user = userEvent.setup()

      const FieldInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String, { testId: string }>> = ({
        field,
        props,
      }) => (
        <div>
          <input
            type="text"
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            onBlur={field.onBlur}
            data-testid={props.testId}
          />
          {Option.isSome(field.error) && <span data-testid={`${props.testId}-error`}>{field.error.value}</span>}
        </div>
      )

      const FieldAInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({ field }) => (
        <FieldInput field={field} props={{ testId: "fieldA" }} />
      )
      const FieldBInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({ field }) => (
        <FieldInput field={field} props={{ testId: "fieldB" }} />
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

      const onSubmit = () => {}

      const form = FormReact.make(formBuilder, {
        fields: { fieldA: FieldAInput, fieldB: FieldBInput },
        onSubmit,
      })

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      const { rerender } = render(
        <form.Initialize key="1" defaultValues={{ fieldA: "error1", fieldB: "valid" }}>
          <form.fieldA />
          <form.fieldB />
          <SubmitButton />
        </form.Initialize>,
      )

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("fieldA-error")).toHaveTextContent("First validation failed")
      })
      expect(screen.queryByTestId("fieldB-error")).not.toBeInTheDocument()

      rerender(
        <form.Initialize key="2" defaultValues={{ fieldA: "valid", fieldB: "error2" }}>
          <form.fieldA />
          <form.fieldB />
          <SubmitButton />
        </form.Initialize>,
      )

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("fieldB-error")).toHaveTextContent("Second validation failed")
      })
      expect(screen.queryByTestId("fieldA-error")).not.toBeInTheDocument()
    })

    it("cross-field error clears when field value changes", async () => {
      const user = userEvent.setup()

      const FieldInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String, { testId: string }>> = ({
        field,
        props,
      }) => (
        <div>
          <input
            type="text"
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            onBlur={field.onBlur}
            data-testid={props.testId}
          />
          {Option.isSome(field.error) && <span data-testid={`${props.testId}-error`}>{field.error.value}</span>}
        </div>
      )

      const PasswordInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({ field }) => (
        <FieldInput field={field} props={{ testId: "password" }} />
      )
      const ConfirmInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({ field }) => (
        <FieldInput field={field} props={{ testId: "confirm" }} />
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

      const onSubmit = () => {}

      const form = FormReact.make(formBuilder, {
        fields: { password: PasswordInput, confirm: ConfirmInput },
        onSubmit,
      })

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(
        <form.Initialize defaultValues={{ password: "secret", confirm: "different" }}>
          <form.password />
          <form.confirm />
          <SubmitButton />
        </form.Initialize>,
      )

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("confirm-error")).toHaveTextContent("Passwords must match")
      })

      const confirmInput = screen.getByTestId("confirm")
      await user.type(confirmInput, "x")

      await waitFor(() => {
        expect(screen.queryByTestId("confirm-error")).not.toBeInTheDocument()
      })
    })

    it("routes cross-field errors to nested array item fields", async () => {
      const user = userEvent.setup()

      const ItemNameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({ field }) => (
        <div>
          <input
            type="text"
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            onBlur={field.onBlur}
            data-testid="item-name"
          />
          {Option.isSome(field.error) && <span data-testid="item-name-error">{field.error.value}</span>}
        </div>
      )

      const ItemSchema = Schema.Struct({
        name: Schema.String.pipe(Schema.minLength(3, { message: () => "Name must be at least 3 characters" })),
      })

      const ItemsArrayField = Field.makeArrayField("items", ItemSchema)
      const formBuilder = FormBuilder.empty.addField(ItemsArrayField)

      const onSubmit = () => {}

      const form = FormReact.make(formBuilder, {
        fields: { items: { name: ItemNameInput } },
        onSubmit,
      })

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(
        <form.Initialize defaultValues={{ items: [{ name: "AB" }] }}>
          <form.items>
            {({ items }) => (
              <>
                {items.map((_, i) => (
                  <form.items.Item key={i} index={i}>
                    <form.items.name />
                  </form.items.Item>
                ))}
              </>
            )}
          </form.items>
          <SubmitButton />
        </form.Initialize>,
      )

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("item-name-error")).toHaveTextContent(
          "Name must be at least 3 characters",
        )
      })
    })
  })

  describe("validation modes", () => {
    it("validates on change with validationMode='onChange'", async () => {
      const user = userEvent.setup()

      const NonEmpty = Schema.String.pipe(Schema.minLength(1, { message: () => "Required" }))
      const NameField = Field.makeField("name", NonEmpty)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const onSubmit = () => {}

      const form = FormReact.make(formBuilder, {
        fields: { name: TextInput },
        mode: "onChange",
        onSubmit,
      })

      render(
        <form.Initialize defaultValues={{ name: "test" }}>
          <form.name />
        </form.Initialize>,
      )

      const input = screen.getByTestId("text-input")

      // Blur to mark as touched (error only shows when touched)
      await user.clear(input)
      await user.tab()

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("Required")
      })
    })

    it("does not validate on blur in onSubmit mode", async () => {
      const user = userEvent.setup()

      const NonEmpty = Schema.String.pipe(Schema.minLength(1, { message: () => "Required" }))
      const NameField = Field.makeField("name", NonEmpty)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const onSubmit = () => {}

      const form = FormReact.make(formBuilder, {
        fields: { name: TextInput },
        mode: "onSubmit",
        onSubmit,
      })

      render(
        <form.Initialize defaultValues={{ name: "" }}>
          <form.name />
        </form.Initialize>,
      )

      const input = screen.getByTestId("text-input")
      await user.click(input)
      await user.tab()

      // In onSubmit mode, no validation happens on blur - wait to ensure no error appears
      await new Promise((r) => setTimeout(r, 50))
      expect(screen.queryByTestId("error")).not.toBeInTheDocument()
    })

    it("validationMode='onSubmit' shows errors after submit attempt", async () => {
      const user = userEvent.setup()

      const NonEmpty = Schema.String.pipe(Schema.minLength(1, { message: () => "Required" }))
      const NameField = Field.makeField("name", NonEmpty)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const onSubmit = () => {}

      const form = FormReact.make(formBuilder, {
        fields: { name: TextInput },
        mode: "onSubmit",
        onSubmit,
      })

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(
        <form.Initialize defaultValues={{ name: "" }}>
          <form.name />
          <SubmitButton />
        </form.Initialize>,
      )

      expect(screen.queryByTestId("error")).not.toBeInTheDocument()

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("Required")
      })
    })
  })

  describe("error handling", () => {
    it("captures error when onSubmit Effect fails", async () => {
      const user = userEvent.setup()

      const NameField = Field.makeField("name", Schema.String)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const onSubmit = () => Effect.fail(new Error("Submission failed"))

      const form = FormReact.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit,
      })

      const SubmitResultDisplay = () => {
        const submitResult = useAtomValue(form.submit)
        return (
          <>
            <span data-testid="result-tag">{submitResult._tag}</span>
            <span data-testid="result-waiting">{String(submitResult.waiting)}</span>
          </>
        )
      }

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(
        <form.Initialize defaultValues={{ name: "test" }}>
          <form.name />
          <SubmitButton />
          <SubmitResultDisplay />
        </form.Initialize>,
      )

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

      const form = FormReact.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit,
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

      render(
        <form.Initialize defaultValues={{ name: "test" }}>
          <form.name />
          <Consumer />
        </form.Initialize>,
      )

      expect(capturedIsDirty).toBe(false)
      expect(Result.isInitial(capturedSubmitResult!)).toBe(true)
    })

    it("exposes submitResult.waiting during submission", async () => {
      const user = userEvent.setup()

      const NameField = Field.makeField("name", Schema.String)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const onSubmit = () => Effect.void.pipe(Effect.delay("50 millis"))

      const form = FormReact.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit,
      })

      const states: Array<{ waiting: boolean; tag: string }> = []

      const Consumer = () => {
        const submitResult = useAtomValue(form.submit)
        states.push({ waiting: submitResult.waiting, tag: submitResult._tag })
        return null
      }

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(
        <form.Initialize defaultValues={{ name: "test" }}>
          <form.name />
          <SubmitButton />
          <Consumer />
        </form.Initialize>,
      )

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

      const form = FormReact.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit,
      })

      let capturedResult: Result.Result<unknown, unknown> | undefined

      const Consumer = () => {
        useAtomSubscribe(form.submit, (v) => {
          capturedResult = v
        }, { immediate: true })
        return null
      }

      const SubmitButton = makeSubmitButton(form.submit, undefined)

      render(
        <form.Initialize defaultValues={{ name: "" }}>
          <form.name />
          <SubmitButton />
          <Consumer />
        </form.Initialize>,
      )

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

      const form = FormReact.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit,
      })

      const dirtyStates: Array<boolean> = []

      const Consumer = () => {
        const isDirty = useAtomValue(form.isDirty)
        dirtyStates.push(isDirty)
        return null
      }

      render(
        <form.Initialize defaultValues={{ name: "initial" }}>
          <form.name />
          <Consumer />
        </form.Initialize>,
      )

      expect(dirtyStates[dirtyStates.length - 1]).toBe(false)

      const input = screen.getByTestId("text-input")
      await user.clear(input)
      await user.type(input, "changed")

      expect(dirtyStates[dirtyStates.length - 1]).toBe(true)
    })
  })

  describe("isDirty lifecycle", () => {
    it("form does not reinitialize on rerender (mount-only initialization)", async () => {
      const user = userEvent.setup()

      const NameField = Field.makeField("name", Schema.String)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const onSubmit = () => {}

      const form = FormReact.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit,
      })

      let isDirty: boolean | undefined

      const TestComponent = () => {
        useAtomSubscribe(form.isDirty, (v) => {
          isDirty = v
        }, { immediate: true })
        return null
      }

      const FormWrapper = ({ defaultName }: { defaultName: string }) => (
        <form.Initialize defaultValues={{ name: defaultName }}>
          <form.name />
          <TestComponent />
        </form.Initialize>
      )

      const { rerender } = render(<FormWrapper defaultName="initial" />)

      expect(isDirty).toBe(false)

      const input = screen.getByTestId("text-input")
      await user.clear(input)
      await user.type(input, "modified")

      expect(isDirty).toBe(true)

      // Rerender with new defaultValues - form does NOT reinitialize
      rerender(<FormWrapper defaultName="new-initial" />)

      expect(screen.getByTestId("text-input")).toHaveValue("modified")
      expect(isDirty).toBe(true)
    })

    it("form reinitializes when using React key to force remount", async () => {
      const user = userEvent.setup()

      const NameField = Field.makeField("name", Schema.String)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const onSubmit = () => {}

      const form = FormReact.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit,
      })

      let isDirty: boolean | undefined

      const TestComponent = () => {
        useAtomSubscribe(form.isDirty, (v) => {
          isDirty = v
        }, { immediate: true })
        return null
      }

      const FormWrapper = ({ defaultName, formKey }: { defaultName: string; formKey: string }) => (
        <form.Initialize key={formKey} defaultValues={{ name: defaultName }}>
          <form.name />
          <TestComponent />
        </form.Initialize>
      )

      const { rerender } = render(<FormWrapper defaultName="initial" formKey="1" />)

      expect(isDirty).toBe(false)

      const input = screen.getByTestId("text-input")
      await user.clear(input)
      await user.type(input, "modified")

      expect(isDirty).toBe(true)

      // New key forces reinitialization
      rerender(<FormWrapper defaultName="new-initial" formKey="2" />)

      await waitFor(() => {
        expect(screen.getByTestId("text-input")).toHaveValue("new-initial")
        expect(isDirty).toBe(false)
      })
    })

    it("isDirty becomes false when value returns to initial", async () => {
      const user = userEvent.setup()

      const NameField = Field.makeField("name", Schema.String)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const onSubmit = () => {}

      const form = FormReact.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit,
      })

      let isDirty: boolean | undefined

      const TestComponent = () => {
        useAtomSubscribe(form.isDirty, (v) => {
          isDirty = v
        }, { immediate: true })
        return null
      }

      render(
        <form.Initialize defaultValues={{ name: "initial" }}>
          <form.name />
          <TestComponent />
        </form.Initialize>,
      )

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

      const form = FormReact.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit,
      })

      const TestComponent = () => {
        const isDirty = useAtomValue(form.isDirty)
        const submit = useAtomSet(form.submit)
        return (
          <>
            <span data-testid="isDirty">{String(isDirty)}</span>
            <button onClick={() => submit()} data-testid="submit">Submit</button>
          </>
        )
      }

      render(
        <form.Initialize defaultValues={{ name: "initial" }}>
          <form.name />
          <TestComponent />
        </form.Initialize>,
      )

      const input = screen.getByTestId("text-input")
      await user.clear(input)
      await user.type(input, "changed")
      expect(screen.getByTestId("isDirty")).toHaveTextContent("true")

      await user.click(screen.getByTestId("submit"))

      // isDirty should still be true (form doesn't auto-reset on submit)
      await waitFor(() => {
        expect(screen.getByTestId("isDirty")).toHaveTextContent("true")
      })
    })

    it("reset() restores form to initial values", async () => {
      const user = userEvent.setup()

      const NameField = Field.makeField("name", Schema.String)
      const formBuilder = FormBuilder.empty.addField(NameField)

      const onSubmit = () => {}

      const form = FormReact.make(formBuilder, {
        fields: { name: TextInput },
        onSubmit,
      })

      const TestComponent = () => {
        const isDirty = useAtomValue(form.isDirty)
        const submitResult = useAtomValue(form.submit)
        const submit = useAtomSet(form.submit)
        const reset = useAtomSet(form.reset)
        return (
          <>
            <span data-testid="isDirty">{String(isDirty)}</span>
            <span data-testid="submitResultTag">{submitResult._tag}</span>
            <button onClick={() => submit()} data-testid="submit">Submit</button>
            <button onClick={() => reset()} data-testid="reset">Reset</button>
          </>
        )
      }

      render(
        <form.Initialize defaultValues={{ name: "initial" }}>
          <form.name />
          <TestComponent />
        </form.Initialize>,
      )

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
})
