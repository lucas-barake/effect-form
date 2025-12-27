import { useAtomValue } from "@effect-atom/atom-react"
import * as Atom from "@effect-atom/atom/Atom"
import * as Result from "@effect-atom/atom/Result"
import { Form, FormReact } from "@lucas-barake/effect-form-react"
import { render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as React from "react"
import { describe, expect, it, vi } from "vitest"

const createRuntime = () => Atom.runtime(Layer.empty)

const TextInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({
  error,
  onBlur,
  onChange,
  value,
}) => (
  <div>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      data-testid="text-input"
    />
    {Option.isSome(error) && <span data-testid="error">{error.value}</span>}
  </div>
)

describe("FormReact.build", () => {
  describe("Form Component", () => {
    it("initializes with default values", () => {
      const NameField = Form.makeField("name", Schema.String)
      const formBuilder = Form.empty.addField(NameField)

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { name: TextInput },
      })

      const onSubmit = form.submit(() => Effect.void)

      render(
        <form.Form defaultValues={{ name: "John" }} onSubmit={onSubmit}>
          <form.name />
        </form.Form>,
      )

      expect(screen.getByTestId("text-input")).toHaveValue("John")
    })
  })

  describe("Field Component", () => {
    it("updates value on change", async () => {
      const user = userEvent.setup()

      const NameField = Form.makeField("name", Schema.String)
      const formBuilder = Form.empty.addField(NameField)

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { name: TextInput },
      })

      const onSubmit = form.submit(() => Effect.void)

      render(
        <form.Form defaultValues={{ name: "" }} onSubmit={onSubmit}>
          <form.name />
        </form.Form>,
      )

      const input = screen.getByTestId("text-input")
      await user.type(input, "Jane")

      expect(input).toHaveValue("Jane")
    })

    it("shows validation error after touch (onBlur mode)", async () => {
      const user = userEvent.setup()

      const NonEmpty = Schema.String.pipe(Schema.minLength(1, { message: () => "Required" }))
      const NameField = Form.makeField("name", NonEmpty)
      const formBuilder = Form.empty.addField(NameField)

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { name: TextInput },
        mode: "onBlur",
      })

      const onSubmit = form.submit(() => Effect.void)

      render(
        <form.Form defaultValues={{ name: "" }} onSubmit={onSubmit}>
          <form.name />
        </form.Form>,
      )

      const input = screen.getByTestId("text-input")
      await user.click(input)
      await user.tab()

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("Required")
      })
    })
  })

  describe("useForm hook", () => {
    it("returns isDirty = false when values match initial", () => {
      const NameField = Form.makeField("name", Schema.String)
      const formBuilder = Form.empty.addField(NameField)

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { name: TextInput },
      })

      const onSubmit = form.submit(() => Effect.void)

      let isDirty: boolean | undefined

      const TestComponent = () => {
        const { isDirty: d } = form.useForm()
        isDirty = d
        return null
      }

      render(
        <form.Form defaultValues={{ name: "test" }} onSubmit={onSubmit}>
          <form.name />
          <TestComponent />
        </form.Form>,
      )

      expect(isDirty).toBe(false)
    })

    it("returns isDirty = true when values differ from initial", async () => {
      const user = userEvent.setup()

      const NameField = Form.makeField("name", Schema.String)
      const formBuilder = Form.empty.addField(NameField)

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { name: TextInput },
      })

      const onSubmit = form.submit(() => Effect.void)

      let isDirty: boolean | undefined

      const TestComponent = () => {
        const { isDirty: d } = form.useForm()
        isDirty = d
        return null
      }

      render(
        <form.Form defaultValues={{ name: "" }} onSubmit={onSubmit}>
          <form.name />
          <TestComponent />
        </form.Form>,
      )

      const input = screen.getByTestId("text-input")
      await user.type(input, "changed")

      expect(isDirty).toBe(true)
    })

    it("submit calls onSubmit with decoded values", async () => {
      const user = userEvent.setup()
      const submitHandler = vi.fn()

      const NameField = Form.makeField("name", Schema.String)
      const formBuilder = Form.empty.addField(NameField)

      const runtime = createRuntime()
      const form = FormReact.build(formBuilder, {
        runtime,
        fields: { name: TextInput },
      })

      const onSubmit = form.submit((values) => Effect.sync(() => submitHandler(values)))

      const SubmitButton = () => {
        const { submit } = form.useForm()
        return <button onClick={submit} data-testid="submit">Submit</button>
      }

      render(
        <form.Form defaultValues={{ name: "John" }} onSubmit={onSubmit}>
          <form.name />
          <SubmitButton />
        </form.Form>,
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

      const FirstNameField = Form.makeField("firstName", Schema.String)
      const LastNameField = Form.makeField("lastName", Schema.String)
      const formBuilder = Form.empty.addField(FirstNameField).addField(LastNameField)

      const NamedInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String> & { name: string }> = ({
        name,
        onBlur,
        onChange,
        value,
      }) => (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          data-testid={name}
        />
      )

      const FirstNameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = (props) => (
        <NamedInput {...props} name="firstName" />
      )

      const LastNameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = (props) => (
        <NamedInput {...props} name="lastName" />
      )

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: {
          firstName: FirstNameInput,
          lastName: LastNameInput,
        },
      })

      const onSubmit = form.submit(() => Effect.void)

      render(
        <form.Form defaultValues={{ firstName: "", lastName: "" }} onSubmit={onSubmit}>
          <form.firstName />
          <form.lastName />
        </form.Form>,
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

      const ItemNameField = Form.makeField("name", Schema.String)
      const itemForm = Form.empty.addField(ItemNameField)

      const TitleField = Form.makeField("title", Schema.String)
      const ItemsArrayField = Form.makeArrayField("items", itemForm)
      const formBuilder = Form.empty.addField(TitleField).addField(ItemsArrayField)

      const TitleInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({
        onBlur,
        onChange,
        value,
      }) => (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          data-testid="title"
        />
      )

      const ItemNameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({
        onBlur,
        onChange,
        value,
      }) => (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          data-testid="item-name"
        />
      )

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: {
          title: TitleInput,
          items: { name: ItemNameInput },
        },
      })

      const onSubmit = form.submit(() => Effect.void)

      render(
        <form.Form
          defaultValues={{ title: "My List", items: [{ name: "Item 1" }] }}
          onSubmit={onSubmit}
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
        </form.Form>,
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

      const ItemNameField = Form.makeField("name", Schema.String)
      const itemForm = Form.empty.addField(ItemNameField)
      const ItemsArrayField = Form.makeArrayField("items", itemForm)
      const formBuilder = Form.empty.addField(ItemsArrayField)

      const ItemNameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({
        onBlur,
        onChange,
        value,
      }) => (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          data-testid="item-name"
        />
      )

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { items: { name: ItemNameInput } },
      })

      const onSubmit = form.submit(() => Effect.void)

      render(
        <form.Form
          defaultValues={{ items: [{ name: "A" }, { name: "B" }, { name: "C" }] }}
          onSubmit={onSubmit}
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
        </form.Form>,
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

      const ItemNameField = Form.makeField("name", Schema.String)
      const itemForm = Form.empty.addField(ItemNameField)
      const ItemsArrayField = Form.makeArrayField("items", itemForm)
      const formBuilder = Form.empty.addField(ItemsArrayField)

      const ItemNameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({
        onBlur,
        onChange,
        value,
      }) => (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          data-testid="item-name"
        />
      )

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { items: { name: ItemNameInput } },
      })

      const onSubmit = form.submit(() => Effect.void)

      render(
        <form.Form
          defaultValues={{ items: [{ name: "First" }, { name: "Second" }, { name: "Third" }] }}
          onSubmit={onSubmit}
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
        </form.Form>,
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

      const ItemNameField = Form.makeField("name", Schema.String)
      const itemForm = Form.empty.addField(ItemNameField)
      const ItemsArrayField = Form.makeArrayField("items", itemForm)
      const formBuilder = Form.empty.addField(ItemsArrayField)

      const ItemNameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({
        onBlur,
        onChange,
        value,
      }) => (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          data-testid="item-name"
        />
      )

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { items: { name: ItemNameInput } },
      })

      const onSubmit = form.submit(() => Effect.void)

      render(
        <form.Form
          defaultValues={{ items: [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }] }}
          onSubmit={onSubmit}
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
        </form.Form>,
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

      const ItemNameField = Form.makeField("name", Schema.String)
      const itemForm = Form.empty.addField(ItemNameField)
      const ItemsArrayField = Form.makeArrayField("items", itemForm)
      const formBuilder = Form.empty.addField(ItemsArrayField)

      const ItemNameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({
        onBlur,
        onChange,
        value,
      }) => (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          data-testid="item-name"
        />
      )

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { items: { name: ItemNameInput } },
      })

      const onSubmit = form.submit(() => Effect.void)

      render(
        <form.Form
          defaultValues={{ items: [{ name: "Item 1" }, { name: "Item 2" }] }}
          onSubmit={onSubmit}
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
        </form.Form>,
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

      const EmailField = Form.makeField("email", AsyncEmail)
      const formBuilder = Form.empty.addField(EmailField)

      const runtime = createRuntime()
      const form = FormReact.build(formBuilder, {
        runtime,
        fields: { email: TextInput },
      })

      const onSubmit = form.submit((values) => Effect.sync(() => submitHandler(values)))

      const SubmitButton = () => {
        const { submit } = form.useForm()
        return <button onClick={submit} data-testid="submit">Submit</button>
      }

      render(
        <form.Form defaultValues={{ email: "test@example.com" }} onSubmit={onSubmit}>
          <form.email />
          <SubmitButton />
        </form.Form>,
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

      const ValidatingInput: React.FC<FormReact.FieldComponentProps<typeof AsyncField>> = ({
        isValidating,
        onBlur,
        onChange,
        value,
      }) => (
        <div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            data-testid="async-input"
          />
          <span data-testid="is-validating">{String(isValidating)}</span>
        </div>
      )

      const AsyncFieldDef = Form.makeField("asyncField", AsyncField)
      const formBuilder = Form.empty.addField(AsyncFieldDef)

      const runtime = createRuntime()
      const form = FormReact.build(formBuilder, {
        runtime,
        fields: { asyncField: ValidatingInput },
        mode: "onBlur",
      })

      const onSubmit = form.submit(() => Effect.void)

      render(
        <form.Form defaultValues={{ asyncField: "" }} onSubmit={onSubmit}>
          <form.asyncField />
        </form.Form>,
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
    it("Form.refine validates across fields and routes error to specific field", async () => {
      const user = userEvent.setup()

      const PasswordInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({
        error,
        onBlur,
        onChange,
        value,
      }) => (
        <div>
          <input
            type="password"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            data-testid="password"
          />
          {Option.isSome(error) && <span data-testid="password-error">{error.value}</span>}
        </div>
      )

      const ConfirmPasswordInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({
        error,
        onBlur,
        onChange,
        value,
      }) => (
        <div>
          <input
            type="password"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            data-testid="confirm-password"
          />
          {Option.isSome(error) && <span data-testid="confirm-password-error">{error.value}</span>}
        </div>
      )

      const PasswordField = Form.makeField("password", Schema.String)
      const ConfirmPasswordField = Form.makeField("confirmPassword", Schema.String)
      const formBuilder = Form.empty.addField(PasswordField).addField(ConfirmPasswordField)
        .refine((values) => {
          if (values.password !== values.confirmPassword) {
            return { path: ["confirmPassword"], message: "Passwords must match" }
          }
        })

      const runtime = createRuntime()
      const form = FormReact.build(formBuilder, {
        runtime,
        fields: {
          password: PasswordInput,
          confirmPassword: ConfirmPasswordInput,
        },
      })

      const onSubmit = form.submit(() => Effect.void)

      const SubmitButton = () => {
        const { submit } = form.useForm()
        return <button onClick={submit} data-testid="submit">Submit</button>
      }

      render(
        <form.Form defaultValues={{ password: "secret", confirmPassword: "different" }} onSubmit={onSubmit}>
          <form.password />
          <form.confirmPassword />
          <SubmitButton />
        </form.Form>,
      )

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("confirm-password-error")).toHaveTextContent("Passwords must match")
      })

      expect(screen.queryByTestId("password-error")).not.toBeInTheDocument()
    })

    it("refineEffect performs async cross-field validation", async () => {
      const user = userEvent.setup()

      const UsernameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({
        error,
        onBlur,
        onChange,
        value,
      }) => (
        <div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            data-testid="username"
          />
          {Option.isSome(error) && <span data-testid="username-error">{error.value}</span>}
        </div>
      )

      const UsernameField = Form.makeField("username", Schema.String)
      const formBuilder = Form.empty
        .addField(UsernameField)
        .refineEffect((values) =>
          Effect.gen(function*() {
            yield* Effect.sleep("20 millis")
            if (values.username === "taken") {
              return { path: ["username"], message: "Username is already taken" }
            }
          })
        )

      const runtime = createRuntime()
      const form = FormReact.build(formBuilder, {
        runtime,
        fields: { username: UsernameInput },
      })

      const onSubmit = form.submit(() => Effect.void)

      const SubmitButton = () => {
        const { submit } = form.useForm()
        return <button onClick={submit} data-testid="submit">Submit</button>
      }

      render(
        <form.Form defaultValues={{ username: "taken" }} onSubmit={onSubmit}>
          <form.username />
          <SubmitButton />
        </form.Form>,
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

      const UsernameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({
        error,
        onBlur,
        onChange,
        value,
      }) => (
        <div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            data-testid="username"
          />
          {Option.isSome(error) && <span data-testid="username-error">{error.value}</span>}
        </div>
      )

      const UsernameField = Form.makeField("username", Schema.String)
      const formBuilder = Form.empty
        .addField(UsernameField)
        .refineEffect((values) =>
          Effect.gen(function*() {
            const validator = yield* UsernameValidator
            const isTaken = yield* validator.isTaken(values.username)
            if (isTaken) {
              return { path: ["username"], message: "Username is already taken" }
            }
          })
        )

      const runtime = Atom.runtime(UsernameValidatorLive)
      const form = FormReact.build(formBuilder, {
        runtime,
        fields: { username: UsernameInput },
      })

      const onSubmit = form.submit(() => Effect.void)

      const SubmitButton = () => {
        const { submit } = form.useForm()
        return <button onClick={submit} data-testid="submit">Submit</button>
      }

      render(
        <form.Form defaultValues={{ username: "taken" }} onSubmit={onSubmit}>
          <form.username />
          <SubmitButton />
        </form.Form>,
      )

      await user.click(screen.getByTestId("submit"))

      // Validation should work using the service
      await waitFor(() => {
        expect(screen.getByTestId("username-error")).toHaveTextContent("Username is already taken")
      })
    })

    it("multiple chained refine() calls are all executed", async () => {
      const user = userEvent.setup()

      const FieldInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String> & { testId: string }> = ({
        error,
        onBlur,
        onChange,
        testId,
        value,
      }) => (
        <div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            data-testid={testId}
          />
          {Option.isSome(error) && <span data-testid={`${testId}-error`}>{error.value}</span>}
        </div>
      )

      const FieldAInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = (props) => (
        <FieldInput {...props} testId="fieldA" />
      )
      const FieldBInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = (props) => (
        <FieldInput {...props} testId="fieldB" />
      )

      const FieldAField = Form.makeField("fieldA", Schema.String)
      const FieldBField = Form.makeField("fieldB", Schema.String)
      const formBuilder = Form.empty
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

      const runtime = createRuntime()
      const form = FormReact.build(formBuilder, {
        runtime,
        fields: { fieldA: FieldAInput, fieldB: FieldBInput },
      })

      const onSubmit = form.submit(() => Effect.void)

      const SubmitButton = () => {
        const { submit } = form.useForm()
        return <button onClick={submit} data-testid="submit">Submit</button>
      }

      const { rerender } = render(
        <form.Form key="1" defaultValues={{ fieldA: "error1", fieldB: "valid" }} onSubmit={onSubmit}>
          <form.fieldA />
          <form.fieldB />
          <SubmitButton />
        </form.Form>,
      )

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("fieldA-error")).toHaveTextContent("First validation failed")
      })
      expect(screen.queryByTestId("fieldB-error")).not.toBeInTheDocument()

      rerender(
        <form.Form key="2" defaultValues={{ fieldA: "valid", fieldB: "error2" }} onSubmit={onSubmit}>
          <form.fieldA />
          <form.fieldB />
          <SubmitButton />
        </form.Form>,
      )

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("fieldB-error")).toHaveTextContent("Second validation failed")
      })
      expect(screen.queryByTestId("fieldA-error")).not.toBeInTheDocument()
    })

    it("cross-field error clears when field value changes", async () => {
      const user = userEvent.setup()

      const FieldInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String> & { testId: string }> = ({
        error,
        onBlur,
        onChange,
        testId,
        value,
      }) => (
        <div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            data-testid={testId}
          />
          {Option.isSome(error) && <span data-testid={`${testId}-error`}>{error.value}</span>}
        </div>
      )

      const PasswordInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = (props) => (
        <FieldInput {...props} testId="password" />
      )
      const ConfirmInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = (props) => (
        <FieldInput {...props} testId="confirm" />
      )

      const PasswordField = Form.makeField("password", Schema.String)
      const ConfirmField = Form.makeField("confirm", Schema.String)
      const formBuilder = Form.empty
        .addField(PasswordField)
        .addField(ConfirmField)
        .refine((values) => {
          if (values.password !== values.confirm) {
            return { path: ["confirm"], message: "Passwords must match" }
          }
        })

      const runtime = createRuntime()
      const form = FormReact.build(formBuilder, {
        runtime,
        fields: { password: PasswordInput, confirm: ConfirmInput },
      })

      const onSubmit = form.submit(() => Effect.void)

      const SubmitButton = () => {
        const { submit } = form.useForm()
        return <button onClick={submit} data-testid="submit">Submit</button>
      }

      render(
        <form.Form defaultValues={{ password: "secret", confirm: "different" }} onSubmit={onSubmit}>
          <form.password />
          <form.confirm />
          <SubmitButton />
        </form.Form>,
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

      const ItemNameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({
        error,
        onBlur,
        onChange,
        value,
      }) => (
        <div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            data-testid="item-name"
          />
          {Option.isSome(error) && <span data-testid="item-name-error">{error.value}</span>}
        </div>
      )

      const ItemSchema = Schema.Struct({
        name: Schema.String.pipe(Schema.minLength(3, { message: () => "Name must be at least 3 characters" })),
      })

      const ItemNameField = Form.makeField("name", ItemSchema.fields.name)
      const itemForm = Form.empty.addField(ItemNameField)
      const ItemsArrayField = Form.makeArrayField("items", itemForm)
      const formBuilder = Form.empty.addField(ItemsArrayField)

      const runtime = createRuntime()
      const form = FormReact.build(formBuilder, {
        runtime,
        fields: { items: { name: ItemNameInput } },
      })

      const onSubmit = form.submit(() => Effect.void)

      const SubmitButton = () => {
        const { submit } = form.useForm()
        return <button onClick={submit} data-testid="submit">Submit</button>
      }

      render(
        <form.Form defaultValues={{ items: [{ name: "AB" }] }} onSubmit={onSubmit}>
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
        </form.Form>,
      )

      await user.click(screen.getByTestId("submit"))

      // The error should appear on the nested array item field, not on the parent
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
      const NameField = Form.makeField("name", NonEmpty)
      const formBuilder = Form.empty.addField(NameField)

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { name: TextInput },
        mode: "onChange",
      })

      const onSubmit = form.submit(() => Effect.void)

      render(
        <form.Form defaultValues={{ name: "test" }} onSubmit={onSubmit}>
          <form.name />
        </form.Form>,
      )

      const input = screen.getByTestId("text-input")

      // Clear the input - this should trigger validation immediately (onChange mode)
      await user.clear(input)
      // Need to blur to mark as touched (error only shows when touched)
      await user.tab()

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("Required")
      })
    })

    it("does not validate on blur in onSubmit mode", async () => {
      const user = userEvent.setup()

      const NonEmpty = Schema.String.pipe(Schema.minLength(1, { message: () => "Required" }))
      const NameField = Form.makeField("name", NonEmpty)
      const formBuilder = Form.empty.addField(NameField)

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { name: TextInput },
        mode: "onSubmit",
      })

      const onSubmit = form.submit(() => Effect.void)

      render(
        <form.Form defaultValues={{ name: "" }} onSubmit={onSubmit}>
          <form.name />
        </form.Form>,
      )

      const input = screen.getByTestId("text-input")
      await user.click(input)
      await user.tab()

      // In onSubmit mode, no validation happens on blur
      // Wait a bit to ensure no error appears
      await new Promise((r) => setTimeout(r, 50))
      expect(screen.queryByTestId("error")).not.toBeInTheDocument()
    })

    it("validationMode='onSubmit' shows errors after submit attempt", async () => {
      const user = userEvent.setup()

      const NonEmpty = Schema.String.pipe(Schema.minLength(1, { message: () => "Required" }))
      const NameField = Form.makeField("name", NonEmpty)
      const formBuilder = Form.empty.addField(NameField)

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { name: TextInput },
        mode: "onSubmit",
      })

      const onSubmit = form.submit(() => Effect.void)

      const SubmitButton = () => {
        const { submit } = form.useForm()
        return <button onClick={submit} data-testid="submit">Submit</button>
      }

      render(
        <form.Form defaultValues={{ name: "" }} onSubmit={onSubmit}>
          <form.name />
          <SubmitButton />
        </form.Form>,
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

      const NameField = Form.makeField("name", Schema.String)
      const formBuilder = Form.empty.addField(NameField)

      const runtime = createRuntime()
      const form = FormReact.build(formBuilder, {
        runtime,
        fields: { name: TextInput },
      })

      const onSubmit = form.submit(() => Effect.fail(new Error("Submission failed")))

      render(
        <form.Form defaultValues={{ name: "test" }} onSubmit={onSubmit}>
          <form.name />
          <form.Subscribe>
            {({ submit, submitResult }) => (
              <>
                <button onClick={submit} data-testid="submit">Submit</button>
                <span data-testid="result-tag">{submitResult._tag}</span>
                <span data-testid="result-waiting">{String(submitResult.waiting)}</span>
              </>
            )}
          </form.Subscribe>
        </form.Form>,
      )

      expect(screen.getByTestId("result-tag")).toHaveTextContent("Initial")

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("result-tag")).toHaveTextContent("Failure")
        expect(screen.getByTestId("result-waiting")).toHaveTextContent("false")
      })
    })
  })

  describe("Subscribe component", () => {
    it("exposes submitResult with initial state", () => {
      const NameField = Form.makeField("name", Schema.String)
      const formBuilder = Form.empty.addField(NameField)

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { name: TextInput },
      })

      const onSubmit = form.submit(() => Effect.void)

      let capturedState: FormReact.SubscribeState<typeof formBuilder.fields> | undefined

      render(
        <form.Form defaultValues={{ name: "test" }} onSubmit={onSubmit}>
          <form.name />
          <form.Subscribe>
            {(state) => {
              capturedState = state
              return null
            }}
          </form.Subscribe>
        </form.Form>,
      )

      expect(capturedState).toBeDefined()
      expect(capturedState!.values).toEqual({ name: "test" })
      expect(capturedState!.isDirty).toBe(false)
      expect(Result.isInitial(capturedState!.submitResult)).toBe(true)
      expect(typeof capturedState!.submit).toBe("function")
    })

    it("exposes submitResult.waiting during submission", async () => {
      const user = userEvent.setup()

      const NameField = Form.makeField("name", Schema.String)
      const formBuilder = Form.empty.addField(NameField)

      const runtime = createRuntime()
      const form = FormReact.build(formBuilder, {
        runtime,
        fields: { name: TextInput },
      })

      const onSubmit = form.submit(() => Effect.void.pipe(Effect.delay("50 millis")))

      const states: Array<{ waiting: boolean; tag: string }> = []

      render(
        <form.Form defaultValues={{ name: "test" }} onSubmit={onSubmit}>
          <form.name />
          <form.Subscribe>
            {({ submit, submitResult }) => {
              states.push({ waiting: submitResult.waiting, tag: submitResult._tag })
              return <button onClick={submit} data-testid="submit">Submit</button>
            }}
          </form.Subscribe>
        </form.Form>,
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
      const NameField = Form.makeField("name", NonEmpty)
      const formBuilder = Form.empty.addField(NameField)

      const runtime = createRuntime()
      const form = FormReact.build(formBuilder, {
        runtime,
        fields: { name: TextInput },
      })

      const onSubmit = form.submit(() => Effect.void)

      let capturedResult: Result.Result<unknown, unknown> | undefined

      render(
        <form.Form defaultValues={{ name: "" }} onSubmit={onSubmit}>
          <form.name />
          <form.Subscribe>
            {({ submit, submitResult }) => {
              capturedResult = submitResult
              return <button onClick={submit} data-testid="submit">Submit</button>
            }}
          </form.Subscribe>
        </form.Form>,
      )

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(capturedResult).toBeDefined()
        expect(Result.isFailure(capturedResult!)).toBe(true)
      })
    })

    it("updates isDirty when values change", async () => {
      const user = userEvent.setup()

      const NameField = Form.makeField("name", Schema.String)
      const formBuilder = Form.empty.addField(NameField)

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { name: TextInput },
      })

      const onSubmit = form.submit(() => Effect.void)

      const dirtyStates: Array<boolean> = []

      render(
        <form.Form defaultValues={{ name: "initial" }} onSubmit={onSubmit}>
          <form.name />
          <form.Subscribe>
            {({ isDirty }) => {
              dirtyStates.push(isDirty)
              return null
            }}
          </form.Subscribe>
        </form.Form>,
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

      const NameField = Form.makeField("name", Schema.String)
      const formBuilder = Form.empty.addField(NameField)

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { name: TextInput },
      })

      const onSubmit = form.submit(() => Effect.void)

      let isDirty: boolean | undefined

      const TestComponent = () => {
        const formHook = form.useForm()
        isDirty = formHook.isDirty
        return null
      }

      const FormWrapper = ({ defaultName }: { defaultName: string }) => (
        <form.Form defaultValues={{ name: defaultName }} onSubmit={onSubmit}>
          <form.name />
          <TestComponent />
        </form.Form>
      )

      const { rerender } = render(<FormWrapper defaultName="initial" />)

      expect(isDirty).toBe(false)

      const input = screen.getByTestId("text-input")
      await user.clear(input)
      await user.type(input, "modified")

      expect(isDirty).toBe(true)

      // Rerender with new defaultValues - form does NOT reinitialize (mount-only)
      rerender(<FormWrapper defaultName="new-initial" />)

      // Values are preserved from the previous render
      expect(screen.getByTestId("text-input")).toHaveValue("modified")
      expect(isDirty).toBe(true)
    })

    it("form reinitializes when using React key to force remount", async () => {
      const user = userEvent.setup()

      const NameField = Form.makeField("name", Schema.String)
      const formBuilder = Form.empty.addField(NameField)

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { name: TextInput },
      })

      const onSubmit = form.submit(() => Effect.void)

      let isDirty: boolean | undefined

      const TestComponent = () => {
        const formHook = form.useForm()
        isDirty = formHook.isDirty
        return null
      }

      const FormWrapper = ({ defaultName, formKey }: { defaultName: string; formKey: string }) => (
        <form.Form key={formKey} defaultValues={{ name: defaultName }} onSubmit={onSubmit}>
          <form.name />
          <TestComponent />
        </form.Form>
      )

      const { rerender } = render(<FormWrapper defaultName="initial" formKey="1" />)

      expect(isDirty).toBe(false)

      const input = screen.getByTestId("text-input")
      await user.clear(input)
      await user.type(input, "modified")

      expect(isDirty).toBe(true)

      // Remount with new key forces reinitialization
      rerender(<FormWrapper defaultName="new-initial" formKey="2" />)

      await waitFor(() => {
        expect(screen.getByTestId("text-input")).toHaveValue("new-initial")
        expect(isDirty).toBe(false)
      })
    })

    it("isDirty becomes false when value returns to initial", async () => {
      const user = userEvent.setup()

      const NameField = Form.makeField("name", Schema.String)
      const formBuilder = Form.empty.addField(NameField)

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { name: TextInput },
      })

      const onSubmit = form.submit(() => Effect.void)

      let isDirty: boolean | undefined

      const TestComponent = () => {
        const formHook = form.useForm()
        isDirty = formHook.isDirty
        return null
      }

      render(
        <form.Form defaultValues={{ name: "initial" }} onSubmit={onSubmit}>
          <form.name />
          <TestComponent />
        </form.Form>,
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

      const NameField = Form.makeField("name", Schema.String)
      const formBuilder = Form.empty.addField(NameField)

      const runtime = createRuntime()
      const form = FormReact.build(formBuilder, {
        runtime,
        fields: { name: TextInput },
      })

      const onSubmit = form.submit(() => Effect.void)

      const TestComponent = () => {
        const formHook = form.useForm()
        return (
          <>
            <span data-testid="isDirty">{String(formHook.isDirty)}</span>
            <button onClick={formHook.submit} data-testid="submit">Submit</button>
          </>
        )
      }

      render(
        <form.Form defaultValues={{ name: "initial" }} onSubmit={onSubmit}>
          <form.name />
          <TestComponent />
        </form.Form>,
      )

      // Modify
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

      const NameField = Form.makeField("name", Schema.String)
      const formBuilder = Form.empty.addField(NameField)

      const runtime = createRuntime()
      const form = FormReact.build(formBuilder, {
        runtime,
        fields: { name: TextInput },
      })

      const onSubmit = form.submit(() => Effect.void)

      const TestComponent = () => {
        const formHook = form.useForm()
        return (
          <>
            <span data-testid="isDirty">{String(formHook.isDirty)}</span>
            <span data-testid="submitResultTag">{formHook.submitResult._tag}</span>
            <button onClick={formHook.submit} data-testid="submit">Submit</button>
            <button onClick={formHook.reset} data-testid="reset">Reset</button>
          </>
        )
      }

      render(
        <form.Form defaultValues={{ name: "initial" }} onSubmit={onSubmit}>
          <form.name />
          <TestComponent />
        </form.Form>,
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

  describe("form state", () => {
    it("tracks submitCount through form atom", async () => {
      const user = userEvent.setup()

      const NameField = Form.makeField("name", Schema.String)
      const formBuilder = Form.empty.addField(NameField)

      const runtime = createRuntime()
      const form = FormReact.build(formBuilder, {
        runtime,
        fields: { name: TextInput },
      })

      const onSubmit = form.submit(() => Effect.void)

      const SubmitCountDisplay = () => {
        const state = Option.getOrThrow(useAtomValue(form.atom))
        return <span data-testid="submit-count">{state.submitCount}</span>
      }

      const SubmitButton = () => {
        const { submit } = form.useForm()
        return <button onClick={submit} data-testid="submit">Submit</button>
      }

      render(
        <form.Form defaultValues={{ name: "test" }} onSubmit={onSubmit}>
          <form.name />
          <SubmitCountDisplay />
          <SubmitButton />
        </form.Form>,
      )

      expect(screen.getByTestId("submit-count")).toHaveTextContent("0")

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("submit-count")).toHaveTextContent("1")
      })
    })
  })

  describe("setValue", () => {
    it("updates a scalar field value using Field identity", async () => {
      const NameField = Form.makeField("name", Schema.String)
      const formBuilder = Form.empty.addField(NameField)

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { name: TextInput },
      })

      const onSubmit = form.submit(() => Effect.void)

      const ValuesDisplay = () => {
        const { values } = form.useForm()
        return <span data-testid="values">{values.name}</span>
      }

      const SetValueButton = () => {
        const { setValue } = form.useForm()
        return (
          <button
            data-testid="set-value-btn"
            onClick={() => setValue(form.fields.name, "Updated")}
          />
        )
      }

      const user = userEvent.setup()
      render(
        <form.Form defaultValues={{ name: "Initial" }} onSubmit={onSubmit}>
          <form.name />
          <ValuesDisplay />
          <SetValueButton />
        </form.Form>,
      )

      expect(screen.getByTestId("values")).toHaveTextContent("Initial")

      await user.click(screen.getByTestId("set-value-btn"))

      expect(screen.getByTestId("values")).toHaveTextContent("Updated")
      expect(screen.getByTestId("text-input")).toHaveValue("Updated")
    })

    it("updates value using functional callback (prev => next)", async () => {
      const CountField = Form.makeField("count", Schema.NumberFromString)
      const formBuilder = Form.empty.addField(CountField)

      const NumberInput: React.FC<FormReact.FieldComponentProps<typeof Schema.NumberFromString>> = ({
        error,
        onBlur,
        onChange,
        value,
      }) => (
        <div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            data-testid="number-input"
          />
          {Option.isSome(error) && <span data-testid="error">{error.value}</span>}
        </div>
      )

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { count: NumberInput },
      })

      const onSubmit = form.submit(() => Effect.void)

      const ValuesDisplay = () => {
        const { values } = form.useForm()
        return <span data-testid="count-value">{values.count}</span>
      }

      const IncrementButton = () => {
        const { setValue } = form.useForm()
        return (
          <button
            data-testid="increment-btn"
            onClick={() => setValue(form.fields.count, (prev) => String(Number(prev) + 1))}
          />
        )
      }

      const user = userEvent.setup()
      render(
        <form.Form defaultValues={{ count: "5" }} onSubmit={onSubmit}>
          <form.count />
          <ValuesDisplay />
          <IncrementButton />
        </form.Form>,
      )

      expect(screen.getByTestId("count-value")).toHaveTextContent("5")

      await user.click(screen.getByTestId("increment-btn"))

      expect(screen.getByTestId("count-value")).toHaveTextContent("6")
    })

    it("updates array items using functional callback (filter)", async () => {
      const ItemIdField = Form.makeField("id", Schema.NumberFromString)
      const ItemNameField = Form.makeField("name", Schema.String)
      const itemForm = Form.empty
        .addField(ItemIdField)
        .addField(ItemNameField)

      const ItemsArrayField = Form.makeArrayField("items", itemForm)
      const formBuilder = Form.empty.addField(ItemsArrayField)

      const ItemNameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({
        onBlur,
        onChange,
        value,
      }) => (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
      )

      const ItemIdInput: React.FC<FormReact.FieldComponentProps<typeof Schema.NumberFromString>> = ({
        onBlur,
        onChange,
        value,
      }) => (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
      )

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { items: { id: ItemIdInput, name: ItemNameInput } },
      })

      const onSubmit = form.submit(() => Effect.void)

      const ItemsCount = () => {
        const { values } = form.useForm()
        return <span data-testid="items-count">{values.items.length}</span>
      }

      const ItemsNames = () => {
        const { values } = form.useForm()
        return <span data-testid="items-names">{values.items.map((i) => i.name).join(",")}</span>
      }

      const FilterButton = () => {
        const { setValue } = form.useForm()
        return (
          <button
            data-testid="filter-btn"
            onClick={() => setValue(form.fields.items, (items) => items.filter((item) => item.name !== "Delete Me"))}
          />
        )
      }

      const user = userEvent.setup()
      render(
        <form.Form
          defaultValues={{
            items: [
              { id: "1", name: "Keep" },
              { id: "2", name: "Delete Me" },
              { id: "3", name: "Also Keep" },
            ],
          }}
          onSubmit={onSubmit}
        >
          <form.items>
            {({ items }) =>
              items.map((_, i) => (
                <form.items.Item key={i} index={i}>
                  <form.items.name />
                </form.items.Item>
              ))}
          </form.items>
          <ItemsCount />
          <ItemsNames />
          <FilterButton />
        </form.Form>,
      )

      expect(screen.getByTestId("items-count")).toHaveTextContent("3")

      await user.click(screen.getByTestId("filter-btn"))

      expect(screen.getByTestId("items-count")).toHaveTextContent("2")
      expect(screen.getByTestId("items-names")).toHaveTextContent("Keep,Also Keep")
    })

    it("marks field as dirty when value differs from initial", async () => {
      const NameField = Form.makeField("name", Schema.String)
      const formBuilder = Form.empty.addField(NameField)

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { name: TextInput },
      })

      const onSubmit = form.submit(() => Effect.void)

      const DirtyDisplay = () => {
        const { isDirty } = form.useForm()
        return isDirty ? <span data-testid="form-dirty">dirty</span> : null
      }

      const SetValueButton = () => {
        const { setValue } = form.useForm()
        return (
          <button
            data-testid="set-value-btn"
            onClick={() => setValue(form.fields.name, "Changed")}
          />
        )
      }

      const user = userEvent.setup()
      render(
        <form.Form defaultValues={{ name: "Initial" }} onSubmit={onSubmit}>
          <form.name />
          <DirtyDisplay />
          <SetValueButton />
        </form.Form>,
      )

      expect(screen.queryByTestId("form-dirty")).not.toBeInTheDocument()

      await user.click(screen.getByTestId("set-value-btn"))

      expect(screen.getByTestId("form-dirty")).toBeInTheDocument()
    })

    it("marks field as clean when value returns to initial", async () => {
      const NameField = Form.makeField("name", Schema.String)
      const formBuilder = Form.empty.addField(NameField)

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { name: TextInput },
      })

      const onSubmit = form.submit(() => Effect.void)

      const DirtyDisplay = () => {
        const { isDirty } = form.useForm()
        return isDirty ? <span data-testid="form-dirty">dirty</span> : null
      }

      const SetValueButtons = () => {
        const { setValue } = form.useForm()
        return (
          <>
            <button
              data-testid="change-btn"
              onClick={() => setValue(form.fields.name, "Changed")}
            />
            <button
              data-testid="restore-btn"
              onClick={() => setValue(form.fields.name, "Initial")}
            />
          </>
        )
      }

      const user = userEvent.setup()
      render(
        <form.Form defaultValues={{ name: "Initial" }} onSubmit={onSubmit}>
          <form.name />
          <DirtyDisplay />
          <SetValueButtons />
        </form.Form>,
      )

      expect(screen.queryByTestId("form-dirty")).not.toBeInTheDocument()

      await user.click(screen.getByTestId("change-btn"))
      expect(screen.getByTestId("form-dirty")).toBeInTheDocument()

      await user.click(screen.getByTestId("restore-btn"))
      expect(screen.queryByTestId("form-dirty")).not.toBeInTheDocument()
    })

    it("clears stale nested dirty paths when parent object is replaced", async () => {
      const StreetField = Form.makeField("street", Schema.String)
      const CityField = Form.makeField("city", Schema.String)
      const addressForm = Form.empty
        .addField(StreetField)
        .addField(CityField)

      const NameField = Form.makeField("name", Schema.String)
      const AddressesArrayField = Form.makeArrayField("addresses", addressForm)
      const formBuilder = Form.empty
        .addField(NameField)
        .addField(AddressesArrayField)

      const StreetInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({
        isDirty,
        onBlur,
        onChange,
        value,
      }) => (
        <div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            data-testid="street-input"
          />
          {isDirty && <span data-testid="street-dirty">dirty</span>}
        </div>
      )

      const CityInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({
        isDirty,
        onBlur,
        onChange,
        value,
      }) => (
        <div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            data-testid="city-input"
          />
          {isDirty && <span data-testid="city-dirty">dirty</span>}
        </div>
      )

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: {
          addresses: { city: CityInput, street: StreetInput },
          name: TextInput,
        },
      })

      const onSubmit = form.submit(() => Effect.void)

      const DirtyDisplay = () => {
        const { isDirty } = form.useForm()
        return isDirty ? <span data-testid="form-dirty">dirty</span> : null
      }

      const ReplaceAddressesButton = () => {
        const { setValue } = form.useForm()
        return (
          <button
            data-testid="replace-addresses-btn"
            onClick={() => setValue(form.fields.addresses, [{ city: "New City", street: "New Street" }])}
          />
        )
      }

      const user = userEvent.setup()
      render(
        <form.Form
          defaultValues={{
            addresses: [{ city: "Original City", street: "Original Street" }],
            name: "Test",
          }}
          onSubmit={onSubmit}
        >
          <form.name />
          <form.addresses>
            {({ items }) =>
              items.map((_, i) => (
                <form.addresses.Item key={i} index={i}>
                  <form.addresses.street />
                  <form.addresses.city />
                </form.addresses.Item>
              ))}
          </form.addresses>
          <DirtyDisplay />
          <ReplaceAddressesButton />
        </form.Form>,
      )

      expect(screen.queryByTestId("form-dirty")).not.toBeInTheDocument()

      const streetInput = screen.getByTestId("street-input")
      await user.clear(streetInput)
      await user.type(streetInput, "Modified Street")

      expect(screen.getByTestId("form-dirty")).toBeInTheDocument()
      expect(screen.queryByTestId("street-dirty")).toBeInTheDocument()

      // Now replace the entire addresses array - this should clear the nested dirty state
      await user.click(screen.getByTestId("replace-addresses-btn"))

      // The addresses array is now different from initial, so form is dirty
      expect(screen.getByTestId("form-dirty")).toBeInTheDocument()

      // But the street field shows the NEW value, not stale dirty state
      expect(screen.getByTestId("street-input")).toHaveValue("New Street")
    })

    it("does not mark as touched by default", async () => {
      const NonEmpty = Schema.String.pipe(Schema.minLength(1, { message: () => "Required" }))

      const TouchedInput: React.FC<FormReact.FieldComponentProps<typeof NonEmpty>> = ({
        error,
        isTouched,
        onBlur,
        onChange,
        value,
      }) => (
        <div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            data-testid="text-input"
          />
          {isTouched && <span data-testid="touched">touched</span>}
          {Option.isSome(error) && <span data-testid="error">{error.value}</span>}
        </div>
      )

      const NameField = Form.makeField("name", NonEmpty)
      const formBuilder = Form.empty.addField(NameField)

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { name: TouchedInput },
        mode: "onBlur",
      })

      const onSubmit = form.submit(() => Effect.void)

      const TestComponent = () => {
        const { setValue } = form.useForm()
        return (
          <button
            data-testid="set-value-btn"
            onClick={() => setValue(form.fields.name, "")}
          />
        )
      }

      const user = userEvent.setup()
      render(
        <form.Form defaultValues={{ name: "Initial" }} onSubmit={onSubmit}>
          <form.name />
          <TestComponent />
        </form.Form>,
      )

      expect(screen.queryByTestId("touched")).not.toBeInTheDocument()

      await user.click(screen.getByTestId("set-value-btn"))

      // Still not touched (setValue doesn't touch by default)
      expect(screen.queryByTestId("touched")).not.toBeInTheDocument()

      // And no error shown (onBlur mode, not touched, not submitted)
      expect(screen.queryByTestId("error")).not.toBeInTheDocument()
    })

    it("triggers validation in mounted components (onChange mode)", async () => {
      const NonEmpty = Schema.String.pipe(Schema.minLength(1, { message: () => "Required" }))

      const NameField = Form.makeField("name", NonEmpty)
      const formBuilder = Form.empty.addField(NameField)

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { name: TextInput },
        mode: "onChange",
      })

      const onSubmit = form.submit(() => Effect.void)

      const TestComponent = () => {
        const { setValue, submit } = form.useForm()
        return (
          <>
            <button
              data-testid="set-empty-btn"
              onClick={() => setValue(form.fields.name, "")}
            />
            <button data-testid="submit-btn" onClick={submit} />
          </>
        )
      }

      const user = userEvent.setup()
      render(
        <form.Form defaultValues={{ name: "Initial" }} onSubmit={onSubmit}>
          <form.name />
          <TestComponent />
        </form.Form>,
      )

      expect(screen.queryByTestId("error")).not.toBeInTheDocument()

      // Set to invalid value - validation runs but errors are hidden until touched/submitted
      await user.click(screen.getByTestId("set-empty-btn"))

      // Errors are only shown after touch or submit (per form behavior)
      await user.click(screen.getByTestId("submit-btn"))

      // Now error should appear (reactive validation ran, submit reveals it)
      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("Required")
      })
    })

    it("clears cross-field errors for the affected path", async () => {
      const PasswordField = Form.makeField("password", Schema.String)
      const ConfirmPasswordField = Form.makeField("confirmPassword", Schema.String)
      const formBuilder = Form.empty
        .addField(PasswordField)
        .addField(ConfirmPasswordField)
        .refine((values) => {
          if (values.password !== values.confirmPassword) {
            return { path: ["confirmPassword"], message: "Passwords don't match" }
          }
          return undefined
        })

      const PasswordInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({
        onBlur,
        onChange,
        value,
      }) => (
        <div>
          <input
            type="password"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            data-testid="password-input"
          />
        </div>
      )

      const ConfirmPasswordInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({
        error,
        onBlur,
        onChange,
        value,
      }) => (
        <div>
          <input
            type="password"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            data-testid="confirm-password-input"
          />
          {Option.isSome(error) && <span data-testid="error">{error.value}</span>}
        </div>
      )

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: {
          confirmPassword: ConfirmPasswordInput,
          password: PasswordInput,
        },
        mode: "onSubmit",
      })

      const onSubmit = form.submit(() => Effect.void)

      const TestComponent = () => {
        const { setValue, submit } = form.useForm()
        return (
          <>
            <button data-testid="submit-btn" onClick={submit} />
            <button
              data-testid="fix-password-btn"
              onClick={() => setValue(form.fields.confirmPassword, "matching")}
            />
          </>
        )
      }

      const user = userEvent.setup()
      render(
        <form.Form
          defaultValues={{ confirmPassword: "different", password: "matching" }}
          onSubmit={onSubmit}
        >
          <form.password />
          <form.confirmPassword />
          <TestComponent />
        </form.Form>,
      )

      await user.click(screen.getByTestId("submit-btn"))

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("Passwords don't match")
      })

      // Fix the password using setValue - should clear the cross-field error
      await user.click(screen.getByTestId("fix-password-btn"))

      await waitFor(() => {
        expect(screen.queryByTestId("error")).not.toBeInTheDocument()
      })
    })
  })

  describe("setValues", () => {
    it("replaces entire form state", async () => {
      const FirstNameField = Form.makeField("firstName", Schema.String)
      const LastNameField = Form.makeField("lastName", Schema.String)
      const formBuilder = Form.empty
        .addField(FirstNameField)
        .addField(LastNameField)

      const FirstNameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({
        onBlur,
        onChange,
        value,
      }) => (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          data-testid="first-name-input"
        />
      )

      const LastNameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({
        onBlur,
        onChange,
        value,
      }) => (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          data-testid="last-name-input"
        />
      )

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { firstName: FirstNameInput, lastName: LastNameInput },
      })

      const onSubmit = form.submit(() => Effect.void)

      const ValuesDisplay = () => {
        const { values } = form.useForm()
        return (
          <>
            <span data-testid="first-name-value">{values.firstName}</span>
            <span data-testid="last-name-value">{values.lastName}</span>
          </>
        )
      }

      const SetValuesButton = () => {
        const { setValues } = form.useForm()
        return (
          <button
            data-testid="set-all-btn"
            onClick={() => setValues({ firstName: "Jane", lastName: "Smith" })}
          />
        )
      }

      const user = userEvent.setup()
      render(
        <form.Form defaultValues={{ firstName: "John", lastName: "Doe" }} onSubmit={onSubmit}>
          <form.firstName />
          <form.lastName />
          <ValuesDisplay />
          <SetValuesButton />
        </form.Form>,
      )

      expect(screen.getByTestId("first-name-value")).toHaveTextContent("John")
      expect(screen.getByTestId("last-name-value")).toHaveTextContent("Doe")

      await user.click(screen.getByTestId("set-all-btn"))

      expect(screen.getByTestId("first-name-value")).toHaveTextContent("Jane")
      expect(screen.getByTestId("last-name-value")).toHaveTextContent("Smith")
      expect(screen.getByTestId("first-name-input")).toHaveValue("Jane")
      expect(screen.getByTestId("last-name-input")).toHaveValue("Smith")
    })

    it("recalculates dirty state for all fields (global reset)", async () => {
      const FirstNameField = Form.makeField("firstName", Schema.String)
      const LastNameField = Form.makeField("lastName", Schema.String)
      const formBuilder = Form.empty
        .addField(FirstNameField)
        .addField(LastNameField)

      const FirstNameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({
        isDirty,
        onBlur,
        onChange,
        value,
      }) => (
        <div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            data-testid="first-name-input"
          />
          {isDirty && <span data-testid="first-name-dirty">dirty</span>}
        </div>
      )

      const LastNameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({
        isDirty,
        onBlur,
        onChange,
        value,
      }) => (
        <div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            data-testid="last-name-input"
          />
          {isDirty && <span data-testid="last-name-dirty">dirty</span>}
        </div>
      )

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { firstName: FirstNameInput, lastName: LastNameInput },
      })

      const onSubmit = form.submit(() => Effect.void)

      const DirtyDisplay = () => {
        const { isDirty } = form.useForm()
        return isDirty ? <span data-testid="form-dirty">dirty</span> : null
      }

      const SetValuesButtons = () => {
        const { setValues } = form.useForm()
        return (
          <>
            <button
              data-testid="set-to-initial-btn"
              onClick={() => setValues({ firstName: "John", lastName: "Doe" })}
            />
            <button
              data-testid="set-to-changed-btn"
              onClick={() => setValues({ firstName: "Changed", lastName: "Values" })}
            />
          </>
        )
      }

      const user = userEvent.setup()
      render(
        <form.Form defaultValues={{ firstName: "John", lastName: "Doe" }} onSubmit={onSubmit}>
          <form.firstName />
          <form.lastName />
          <DirtyDisplay />
          <SetValuesButtons />
        </form.Form>,
      )

      expect(screen.queryByTestId("form-dirty")).not.toBeInTheDocument()
      expect(screen.queryByTestId("first-name-dirty")).not.toBeInTheDocument()

      const firstNameInput = screen.getByTestId("first-name-input")
      await user.clear(firstNameInput)
      await user.type(firstNameInput, "Modified")

      expect(screen.getByTestId("form-dirty")).toBeInTheDocument()
      expect(screen.queryByTestId("first-name-dirty")).toBeInTheDocument()

      await user.click(screen.getByTestId("set-to-initial-btn"))

      expect(screen.queryByTestId("form-dirty")).not.toBeInTheDocument()
      expect(screen.queryByTestId("first-name-dirty")).not.toBeInTheDocument()

      await user.click(screen.getByTestId("set-to-changed-btn"))

      expect(screen.getByTestId("form-dirty")).toBeInTheDocument()
    })

    it("clears ALL cross-field errors", async () => {
      const PasswordField = Form.makeField("password", Schema.String)
      const ConfirmPasswordField = Form.makeField("confirmPassword", Schema.String)
      const formBuilder = Form.empty
        .addField(PasswordField)
        .addField(ConfirmPasswordField)
        .refine((values) => {
          if (values.password !== values.confirmPassword) {
            return { path: ["confirmPassword"], message: "Passwords don't match" }
          }
          return undefined
        })

      const PasswordInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({
        onBlur,
        onChange,
        value,
      }) => (
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          data-testid="password-input"
        />
      )

      const ConfirmPasswordInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({
        error,
        onBlur,
        onChange,
        value,
      }) => (
        <div>
          <input
            type="password"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            data-testid="confirm-password-input"
          />
          {Option.isSome(error) && <span data-testid="error">{error.value}</span>}
        </div>
      )

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: {
          confirmPassword: ConfirmPasswordInput,
          password: PasswordInput,
        },
        mode: "onSubmit",
      })

      const onSubmit = form.submit(() => Effect.void)

      const TestComponent = () => {
        const { setValues, submit } = form.useForm()
        return (
          <>
            <button data-testid="submit-btn" onClick={submit} />
            <button
              data-testid="set-all-btn"
              onClick={() => setValues({ confirmPassword: "new", password: "new" })}
            />
          </>
        )
      }

      const user = userEvent.setup()
      render(
        <form.Form
          defaultValues={{ confirmPassword: "different", password: "matching" }}
          onSubmit={onSubmit}
        >
          <form.password />
          <form.confirmPassword />
          <TestComponent />
        </form.Form>,
      )

      await user.click(screen.getByTestId("submit-btn"))

      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("Passwords don't match")
      })

      // Use setValues to replace all values - should clear ALL cross-field errors
      await user.click(screen.getByTestId("set-all-btn"))

      await waitFor(() => {
        expect(screen.queryByTestId("error")).not.toBeInTheDocument()
      })
    })

    it("triggers validation for all mounted fields (onChange mode)", async () => {
      const NonEmpty = Schema.String.pipe(Schema.minLength(1, { message: () => "Required" }))

      const ErrorInput: React.FC<FormReact.FieldComponentProps<Schema.Schema<string, string, never>>> = ({
        error,
        onBlur,
        onChange,
        value,
      }) => (
        <div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            data-testid="text-input"
          />
          {Option.isSome(error) && <span data-testid="error">{error.value}</span>}
        </div>
      )

      const NameField = Form.makeField("name", NonEmpty)
      const formBuilder = Form.empty.addField(NameField)

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { name: ErrorInput },
        mode: "onChange",
      })

      const onSubmit = form.submit(() => Effect.void)

      const TestComponent = () => {
        const { setValues, submit } = form.useForm()
        return (
          <>
            <button
              data-testid="set-empty-btn"
              onClick={() => setValues({ name: "" })}
            />
            <button data-testid="submit-btn" onClick={submit} />
          </>
        )
      }

      const user = userEvent.setup()
      render(
        <form.Form defaultValues={{ name: "Initial" }} onSubmit={onSubmit}>
          <form.name />
          <TestComponent />
        </form.Form>,
      )

      expect(screen.queryByTestId("error")).not.toBeInTheDocument()

      // Set to invalid value using setValues - validation runs but errors are hidden until touched/submitted
      await user.click(screen.getByTestId("set-empty-btn"))

      // Errors are only shown after touch or submit (per form behavior)
      await user.click(screen.getByTestId("submit-btn"))

      // Now error should appear (reactive validation ran, submit reveals it)
      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("Required")
      })
    })
  })

  describe("array field cross-field errors with indexed paths", () => {
    it("routes cross-field errors to specific array item fields (items[1].name)", async () => {
      const user = userEvent.setup()

      const ItemNameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({
        error,
        onBlur,
        onChange,
        value,
      }) => (
        <div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            data-testid="item-name"
          />
          {Option.isSome(error) && <span data-testid="item-name-error">{error.value}</span>}
        </div>
      )

      const ItemNameField = Form.makeField("name", Schema.String)
      const itemForm = Form.empty.addField(ItemNameField)
      const ItemsArrayField = Form.makeArrayField("items", itemForm)

      const formBuilder = Form.empty.addField(ItemsArrayField)
        .refine((values) => {
          // Check for duplicate names across items
          const names = values.items.map((item) => item.name)
          const seen = new Map<string, number>()
          for (let i = 0; i < names.length; i++) {
            const name = names[i]
            if (seen.has(name)) {
              // Return FilterIssue directly with path to the duplicate item
              return {
                path: ["items", i, "name"],
                message: `Duplicate name: ${name}`,
              }
            }
            seen.set(name, i)
          }
        })

      const runtime = createRuntime()
      const form = FormReact.build(formBuilder, {
        runtime,
        fields: { items: { name: ItemNameInput } },
      })

      const onSubmit = form.submit(() => Effect.void)

      const SubmitButton = () => {
        const { submit } = form.useForm()
        return <button onClick={submit} data-testid="submit">Submit</button>
      }

      render(
        <form.Form
          defaultValues={{
            items: [
              { name: "first" },
              { name: "second" },
              { name: "first" }, // Duplicate - should get error
            ],
          }}
          onSubmit={onSubmit}
        >
          <form.items>
            {({ items }) => (
              <>
                {items.map((_, i) => (
                  <div key={i} data-testid={`item-${i}`}>
                    <form.items.Item index={i}>
                      <form.items.name />
                    </form.items.Item>
                  </div>
                ))}
              </>
            )}
          </form.items>
          <SubmitButton />
        </form.Form>,
      )

      await user.click(screen.getByTestId("submit"))

      // Error should appear only on the third item (index 2)
      await waitFor(() => {
        const errorElements = screen.getAllByTestId("item-name-error")
        expect(errorElements.length).toBe(1)
        expect(errorElements[0]).toHaveTextContent("Duplicate name: first")
      })

      const inputs = screen.getAllByTestId("item-name") as Array<HTMLInputElement>
      expect(inputs[0].value).toBe("first")
      expect(inputs[1].value).toBe("second")
      expect(inputs[2].value).toBe("first")
    })

    it("clears array item cross-field errors when value changes", async () => {
      const user = userEvent.setup()

      const ItemNameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({
        error,
        onBlur,
        onChange,
        value,
      }) => (
        <div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            data-testid="item-name"
          />
          {Option.isSome(error) && <span data-testid="item-name-error">{error.value}</span>}
        </div>
      )

      const ItemNameField = Form.makeField("name", Schema.String)
      const itemForm = Form.empty.addField(ItemNameField)
      const ItemsArrayField = Form.makeArrayField("items", itemForm)

      const formBuilder = Form.empty.addField(ItemsArrayField)
        .refine((values) => {
          // Validation: first item name must not be "forbidden"
          if (values.items[0]?.name === "forbidden") {
            return {
              path: ["items", 0, "name"],
              message: "This value is forbidden",
            }
          }
        })

      const runtime = createRuntime()
      const form = FormReact.build(formBuilder, {
        runtime,
        fields: { items: { name: ItemNameInput } },
      })

      const onSubmit = form.submit(() => Effect.void)

      const SubmitButton = () => {
        const { submit } = form.useForm()
        return <button onClick={submit} data-testid="submit">Submit</button>
      }

      render(
        <form.Form defaultValues={{ items: [{ name: "forbidden" }] }} onSubmit={onSubmit}>
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
        </form.Form>,
      )

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("item-name-error")).toHaveTextContent("This value is forbidden")
      })

      const input = screen.getByTestId("item-name")
      await user.clear(input)
      await user.type(input, "allowed")

      await waitFor(() => {
        expect(screen.queryByTestId("item-name-error")).not.toBeInTheDocument()
      })
    })

    it("handles async cross-field validation on array item paths", async () => {
      const user = userEvent.setup()

      const ItemNameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = ({
        error,
        onBlur,
        onChange,
        value,
      }) => (
        <div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            data-testid="item-name"
          />
          {Option.isSome(error) && <span data-testid="item-name-error">{error.value}</span>}
        </div>
      )

      const ItemNameField = Form.makeField("name", Schema.String)
      const itemForm = Form.empty.addField(ItemNameField)
      const ItemsArrayField = Form.makeArrayField("items", itemForm)

      const formBuilder = Form.empty.addField(ItemsArrayField)
        .refineEffect((values) =>
          Effect.gen(function*() {
            yield* Effect.sleep("20 millis")
            if (values.items[0]?.name === "async-forbidden") {
              return {
                path: ["items", 0, "name"],
                message: "Async validation failed",
              }
            }
          })
        )

      const runtime = createRuntime()
      const form = FormReact.build(formBuilder, {
        runtime,
        fields: { items: { name: ItemNameInput } },
      })

      const onSubmit = form.submit(() => Effect.void)

      const SubmitButton = () => {
        const { submit } = form.useForm()
        return <button onClick={submit} data-testid="submit">Submit</button>
      }

      render(
        <form.Form defaultValues={{ items: [{ name: "async-forbidden" }] }} onSubmit={onSubmit}>
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
        </form.Form>,
      )

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("item-name-error")).toHaveTextContent("Async validation failed")
      }, { timeout: 200 })
    })

    it("routes schema validation errors to correct array item paths", async () => {
      const user = userEvent.setup()

      const ItemNameInput: React.FC<FormReact.FieldComponentProps<Schema.Schema<string, string, never>>> = ({
        error,
        onBlur,
        onChange,
        value,
      }) => (
        <div>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            data-testid="item-name"
          />
          {Option.isSome(error) && <span data-testid="item-name-error">{error.value}</span>}
        </div>
      )

      const ItemNameSchema = Schema.String.pipe(
        Schema.minLength(3, { message: () => "Name must be at least 3 characters" }),
      )
      const ItemNameField = Form.makeField("name", ItemNameSchema)
      const itemForm = Form.empty.addField(ItemNameField)
      const ItemsArrayField = Form.makeArrayField("items", itemForm)
      const formBuilder = Form.empty.addField(ItemsArrayField)

      const runtime = createRuntime()
      const form = FormReact.build(formBuilder, {
        runtime,
        fields: { items: { name: ItemNameInput } },
      })

      const onSubmit = form.submit(() => Effect.void)

      const SubmitButton = () => {
        const { submit } = form.useForm()
        return <button onClick={submit} data-testid="submit">Submit</button>
      }

      render(
        <form.Form
          defaultValues={{
            items: [
              { name: "valid-name" },
              { name: "ab" }, // Invalid - too short
            ],
          }}
          onSubmit={onSubmit}
        >
          <form.items>
            {({ items }) => (
              <>
                {items.map((_, i) => (
                  <div key={i} data-testid={`item-${i}`}>
                    <form.items.Item index={i}>
                      <form.items.name />
                    </form.items.Item>
                  </div>
                ))}
              </>
            )}
          </form.items>
          <SubmitButton />
        </form.Form>,
      )

      await user.click(screen.getByTestId("submit"))

      // Error should appear only on the second item (index 1)
      await waitFor(() => {
        const errorElements = screen.getAllByTestId("item-name-error")
        expect(errorElements.length).toBe(1)
        expect(errorElements[0]).toHaveTextContent("Name must be at least 3 characters")
      })

      const inputs = screen.getAllByTestId("item-name") as Array<HTMLInputElement>
      expect(inputs[0].value).toBe("valid-name")
      expect(inputs[1].value).toBe("ab")
    })
  })
})
