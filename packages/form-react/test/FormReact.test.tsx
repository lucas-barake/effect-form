import { useAtomValue } from "@effect-atom/atom-react"
import * as Atom from "@effect-atom/atom/Atom"
import * as Result from "@effect-atom/atom/Result"
import { Form, FormReact } from "@lucas-barake/effect-form-react"
import { render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
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
      const formBuilder = Form.empty.addField("name", Schema.String)

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

      const formBuilder = Form.empty.addField("name", Schema.String)

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

      const formBuilder = Form.empty.addField("name", NonEmpty)

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
      const formBuilder = Form.empty.addField("name", Schema.String)

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

      const formBuilder = Form.empty.addField("name", Schema.String)

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

      const formBuilder = Form.empty.addField("name", Schema.String)

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

      const formBuilder = Form.empty.addField("firstName", Schema.String).addField("lastName", Schema.String)

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

      const itemForm = Form.empty.addField("name", Schema.String)

      const formBuilder = Form.empty.addField("title", Schema.String).addArray("items", itemForm)

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

      const itemForm = Form.empty.addField("name", Schema.String)
      const formBuilder = Form.empty.addArray("items", itemForm)

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

      const itemForm = Form.empty.addField("name", Schema.String)
      const formBuilder = Form.empty.addArray("items", itemForm)

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

      const itemForm = Form.empty.addField("name", Schema.String)
      const formBuilder = Form.empty.addArray("items", itemForm)

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

      const itemForm = Form.empty.addField("name", Schema.String)
      const formBuilder = Form.empty.addArray("items", itemForm)

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

      const formBuilder = Form.empty.addField("email", AsyncEmail)

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

      const formBuilder = Form.empty.addField("asyncField", AsyncField)

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

      const formBuilder = Form.empty.addField("password", Schema.String).addField("confirmPassword", Schema.String)
        .refine((values, ctx) => {
          if (values.password !== values.confirmPassword) {
            return ctx.error("confirmPassword", "Passwords must match")
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

      // Password field should NOT have error
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

      const formBuilder = Form.empty
        .addField("username", Schema.String)
        .refineEffect((values, ctx) =>
          Effect.gen(function*() {
            yield* Effect.sleep("20 millis")
            if (values.username === "taken") {
              return ctx.error("username", "Username is already taken")
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

      const formBuilder = Form.empty
        .addField("fieldA", Schema.String)
        .addField("fieldB", Schema.String)
        .refine((values, ctx) => {
          if (values.fieldA === "error1") {
            return ctx.error("fieldA", "First validation failed")
          }
        })
        .refine((values, ctx) => {
          if (values.fieldB === "error2") {
            return ctx.error("fieldB", "Second validation failed")
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

      // First test: trigger first refinement error
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

      // Second test: trigger second refinement error
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

      const formBuilder = Form.empty
        .addField("password", Schema.String)
        .addField("confirm", Schema.String)
        .refine((values, ctx) => {
          if (values.password !== values.confirm) {
            return ctx.error("confirm", "Passwords must match")
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

      // Type in the confirm field to change its value
      const confirmInput = screen.getByTestId("confirm")
      await user.type(confirmInput, "x")

      // Error should be cleared after value changes
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

      const formBuilder = Form.empty.addArray(
        "items",
        Form.empty.addField("name", ItemSchema.fields.name),
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

      const formBuilder = Form.empty.addField("name", NonEmpty)

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

      const formBuilder = Form.empty.addField("name", NonEmpty)

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

      const formBuilder = Form.empty.addField("name", NonEmpty)

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

      // No error before submit
      expect(screen.queryByTestId("error")).not.toBeInTheDocument()

      // Click submit
      await user.click(screen.getByTestId("submit"))

      // Error should appear after submit attempt
      await waitFor(() => {
        expect(screen.getByTestId("error")).toHaveTextContent("Required")
      })
    })
  })

  describe("error handling", () => {
    it("captures error when onSubmit Effect fails", async () => {
      const user = userEvent.setup()

      const formBuilder = Form.empty.addField("name", Schema.String)

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
      const formBuilder = Form.empty.addField("name", Schema.String)

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

      const formBuilder = Form.empty.addField("name", Schema.String)

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
      const formBuilder = Form.empty.addField("name", NonEmpty)

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

      const formBuilder = Form.empty.addField("name", Schema.String)

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

      const formBuilder = Form.empty.addField("name", Schema.String)

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

      // Modify the form
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

      const formBuilder = Form.empty.addField("name", Schema.String)

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

      // Modify the form
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

      const formBuilder = Form.empty.addField("name", Schema.String)

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

      // Modify
      await user.clear(input)
      await user.type(input, "changed")
      expect(isDirty).toBe(true)

      // Return to initial value
      await user.clear(input)
      await user.type(input, "initial")
      expect(isDirty).toBe(false)
    })

    it("isDirty remains after successful submission", async () => {
      const user = userEvent.setup()

      const formBuilder = Form.empty.addField("name", Schema.String)

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

      // Submit
      await user.click(screen.getByTestId("submit"))

      // isDirty should still be true (form doesn't auto-reset on submit)
      await waitFor(() => {
        expect(screen.getByTestId("isDirty")).toHaveTextContent("true")
      })
    })

    it("reset() restores form to initial values", async () => {
      const user = userEvent.setup()

      const formBuilder = Form.empty.addField("name", Schema.String)

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

      // Modify the form
      const input = screen.getByTestId("text-input")
      await user.clear(input)
      await user.type(input, "modified")

      expect(screen.getByTestId("isDirty")).toHaveTextContent("true")
      expect(screen.getByTestId("text-input")).toHaveValue("modified")

      // Submit to change submitResult
      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(screen.getByTestId("submitResultTag")).toHaveTextContent("Success")
      })

      // Reset the form
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

      const formBuilder = Form.empty.addField("name", Schema.String)

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
})
