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

const TextInput: React.FC<
  FormReact.FieldComponentProps<typeof Schema.String> & { readonly testId?: string }
> = ({ error, onBlur, onChange, testId = "text-input", value }) => (
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

const NameInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = (props) => (
  <TextInput {...props} testId="name-input" />
)

const AgeInput: React.FC<FormReact.FieldComponentProps<typeof Schema.String>> = (props) => (
  <TextInput {...props} testId="age-input" />
)

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe("Debounce and Auto-Submit", () => {
  describe("Manual Submit Debounce", () => {
    it("should debounce validation updates in onChange mode", async () => {
      const user = userEvent.setup()

      const MinLength = Schema.String.pipe(
        Schema.minLength(5, { message: () => "Must be at least 5 characters" }),
      )

      const formBuilder = Form.empty.addField("name", MinLength)

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { name: TextInput },
        mode: { onChange: { debounce: "300 millis" } },
      })

      const onSubmit = form.submit(() => Effect.void)

      render(
        <form.Form defaultValues={{ name: "Valid" }} onSubmit={onSubmit}>
          <form.name />
        </form.Form>,
      )

      const input = screen.getByTestId("text-input")

      await user.clear(input)
      await user.type(input, "Bad")
      await user.tab()

      // userEvent operations take some time but < 300ms typically
      expect(screen.queryByTestId("text-input-error")).not.toBeInTheDocument()

      await waitFor(
        () => {
          expect(screen.getByTestId("text-input-error")).toHaveTextContent(
            "Must be at least 5 characters",
          )
        },
        { timeout: 500 },
      )
    })
  })

  describe("Auto-Submit Happy Path", () => {
    it("should auto-submit valid form data after debounce", async () => {
      const user = userEvent.setup()
      const submitHandler = vi.fn()

      const formBuilder = Form.empty.addField("name", Schema.String)

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { name: TextInput },
        mode: { onChange: { debounce: "100 millis", autoSubmit: true } },
      })

      const onSubmit = form.submit((values) => Effect.sync(() => submitHandler(values)))

      render(
        <form.Form defaultValues={{ name: "" }} onSubmit={onSubmit}>
          <form.name />
        </form.Form>,
      )

      const input = screen.getByTestId("text-input")

      await user.type(input, "Lucas")

      expect(submitHandler).not.toHaveBeenCalled()

      await waitFor(
        () => {
          expect(submitHandler).toHaveBeenCalledWith({ name: "Lucas" })
        },
        { timeout: 300 },
      )
    })
  })

  describe("Race Condition Guard", () => {
    it("should batch updates from multiple fields into a single auto-submission", async () => {
      const user = userEvent.setup()
      const submitHandler = vi.fn()

      const formBuilder = Form.empty
        .addField("name", Schema.String)
        .addField("age", Schema.String)

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { name: NameInput, age: AgeInput },
        mode: { onChange: { debounce: "100 millis", autoSubmit: true } },
      })

      const onSubmit = form.submit((values) => Effect.sync(() => submitHandler(values)))

      render(
        <form.Form defaultValues={{ name: "", age: "" }} onSubmit={onSubmit}>
          <form.name />
          <form.age />
        </form.Form>,
      )

      const nameInput = screen.getByTestId("name-input")
      const ageInput = screen.getByTestId("age-input")

      await user.type(nameInput, "Lucas")
      await user.type(ageInput, "30")

      // Debounce resets with each field change
      await delay(50)
      expect(submitHandler).not.toHaveBeenCalled()

      await waitFor(
        () => {
          expect(submitHandler).toHaveBeenCalledTimes(1)
          expect(submitHandler).toHaveBeenCalledWith({ name: "Lucas", age: "30" })
        },
        { timeout: 300 },
      )
    })
  })

  describe("Invalid State Guard", () => {
    it("should NOT auto-submit if validation fails", async () => {
      const user = userEvent.setup()
      const submitHandler = vi.fn()

      const MinLength = Schema.String.pipe(
        Schema.minLength(5, { message: () => "Must be at least 5 characters" }),
      )

      const formBuilder = Form.empty.addField("name", MinLength)

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { name: TextInput },
        mode: { onChange: { debounce: "50 millis", autoSubmit: true } },
      })

      const onSubmit = form.submit((values) => Effect.sync(() => submitHandler(values)))

      render(
        <form.Form defaultValues={{ name: "" }} onSubmit={onSubmit}>
          <form.name />
        </form.Form>,
      )

      const input = screen.getByTestId("text-input")

      await user.type(input, "Bad")
      await user.tab()

      await waitFor(
        () => {
          expect(screen.getByTestId("text-input-error")).toHaveTextContent(
            "Must be at least 5 characters",
          )
        },
        { timeout: 200 },
      )

      await delay(100)

      expect(submitHandler).not.toHaveBeenCalled()
    })
  })

  describe("Unmount Safety", () => {
    it("should cancel pending submission on unmount", async () => {
      const user = userEvent.setup()
      const submitHandler = vi.fn()

      const formBuilder = Form.empty.addField("name", Schema.String)

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { name: TextInput },
        mode: { onChange: { debounce: "100 millis", autoSubmit: true } },
      })

      const onSubmit = form.submit((values) => Effect.sync(() => submitHandler(values)))

      const { unmount } = render(
        <form.Form defaultValues={{ name: "" }} onSubmit={onSubmit}>
          <form.name />
        </form.Form>,
      )

      const input = screen.getByTestId("text-input")

      await user.type(input, "Lucas")

      unmount()

      await delay(200)

      expect(submitHandler).not.toHaveBeenCalled()
    })
  })

  describe("onBlur Auto-Submit", () => {
    it("should auto-submit on blur when mode is onBlur with autoSubmit", async () => {
      const user = userEvent.setup()
      const submitHandler = vi.fn()

      const formBuilder = Form.empty.addField("name", Schema.String)

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { name: TextInput },
        mode: { onBlur: { autoSubmit: true } },
      })

      const onSubmit = form.submit((values) => Effect.sync(() => submitHandler(values)))

      render(
        <form.Form defaultValues={{ name: "" }} onSubmit={onSubmit}>
          <form.name />
        </form.Form>,
      )

      const input = screen.getByTestId("text-input")

      await user.type(input, "Lucas")

      expect(submitHandler).not.toHaveBeenCalled()

      await user.tab()

      await waitFor(
        () => {
          expect(submitHandler).toHaveBeenCalledWith({ name: "Lucas" })
        },
        { timeout: 200 },
      )
    })
  })

  describe("No debounce in simple onChange mode", () => {
    it("should validate immediately in onChange mode without debounce config", async () => {
      const user = userEvent.setup()

      const MinLength = Schema.String.pipe(
        Schema.minLength(5, { message: () => "Must be at least 5 characters" }),
      )

      const formBuilder = Form.empty.addField("name", MinLength)

      const form = FormReact.build(formBuilder, {
        runtime: createRuntime(),
        fields: { name: TextInput },
        mode: "onChange",
      })

      const onSubmit = form.submit(() => Effect.void)

      render(
        <form.Form defaultValues={{ name: "Valid" }} onSubmit={onSubmit}>
          <form.name />
        </form.Form>,
      )

      const input = screen.getByTestId("text-input")

      await user.clear(input)
      await user.type(input, "Bad")
      await user.tab()

      await waitFor(() => {
        expect(screen.getByTestId("text-input-error")).toHaveTextContent(
          "Must be at least 5 characters",
        )
      })
    })
  })
})
