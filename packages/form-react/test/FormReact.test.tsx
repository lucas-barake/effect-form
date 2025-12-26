import * as Atom from "@effect-atom/atom/Atom"
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

const NumberInput: React.FC<FormReact.FieldComponentProps<typeof Schema.NumberFromString>> = ({
  error,
  onBlur,
  onChange,
  value,
}) => (
  <div>
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      data-testid="number-input"
    />
    {Option.isSome(error) && <span data-testid="number-error">{error.value}</span>}
  </div>
)

describe("FormReact.build", () => {
  describe("Form Component", () => {
    it("renders form with fields", () => {
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

      expect(screen.getByTestId("text-input")).toBeInTheDocument()
    })

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
      })

      const onSubmit = form.submit(() => Effect.void)

      render(
        <form.Form defaultValues={{ name: "" }} onSubmit={onSubmit} validationMode="onBlur">
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

  describe("submit helper", () => {
    it("creates a typed submit handler", () => {
      const formBuilder = Form.empty.addField("email", Schema.String).addField("age", Schema.NumberFromString)

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: {
          email: TextInput,
          age: NumberInput,
        },
      })

      const handler = form.submit((values) => {
        void (values.email as string)
        void (values.age as number)
        return Effect.void
      })

      expect(handler).toBeDefined()
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

    it("cross-field validation passes when fields match", async () => {
      const user = userEvent.setup()
      const submitHandler = vi.fn()

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
          password: TextInput,
          confirmPassword: TextInput,
        },
      })

      const onSubmit = form.submit((values) => Effect.sync(() => submitHandler(values)))

      const SubmitButton = () => {
        const { submit } = form.useForm()
        return <button onClick={submit} data-testid="submit">Submit</button>
      }

      render(
        <form.Form defaultValues={{ password: "secret123", confirmPassword: "secret123" }} onSubmit={onSubmit}>
          <form.password />
          <form.confirmPassword />
          <SubmitButton />
        </form.Form>,
      )

      await user.click(screen.getByTestId("submit"))

      await waitFor(() => {
        expect(submitHandler).toHaveBeenCalledWith({ password: "secret123", confirmPassword: "secret123" })
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
      })

      const onSubmit = form.submit(() => Effect.void)

      render(
        <form.Form defaultValues={{ name: "test" }} onSubmit={onSubmit} validationMode="onChange">
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
      })

      const onSubmit = form.submit(() => Effect.void)

      render(
        <form.Form defaultValues={{ name: "" }} onSubmit={onSubmit} validationMode="onSubmit">
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
  })
})
