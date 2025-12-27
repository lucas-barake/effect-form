import { describe, expect, it } from "vitest"
import { parse } from "../src/Mode.js"

describe("Mode", () => {
  describe("parse", () => {
    it("parses string mode", () => {
      expect(parse("onSubmit")).toEqual({ validation: "onSubmit", debounce: null, autoSubmit: false })
      expect(parse("onBlur")).toEqual({ validation: "onBlur", debounce: null, autoSubmit: false })
      expect(parse("onChange")).toEqual({ validation: "onChange", debounce: null, autoSubmit: false })
    })

    it("defaults to 'onSubmit' when no mode provided", () => {
      const result = parse()

      expect(result).toEqual({
        validation: "onSubmit",
        debounce: null,
        autoSubmit: false,
      })
    })

    it("parses onBlur with autoSubmit object mode", () => {
      const result = parse({ onBlur: { autoSubmit: true } })

      expect(result).toEqual({
        validation: "onBlur",
        debounce: null,
        autoSubmit: true,
      })
    })

    it("parses onChange with debounce (number)", () => {
      const result = parse({ onChange: { debounce: 300 } })

      expect(result).toEqual({
        validation: "onChange",
        debounce: 300,
        autoSubmit: false,
      })
    })

    it("parses onChange with debounce (string duration)", () => {
      const result = parse({ onChange: { debounce: "500 millis" } })

      expect(result).toEqual({
        validation: "onChange",
        debounce: 500,
        autoSubmit: false,
      })
    })

    it("parses onChange with debounce and autoSubmit true", () => {
      const result = parse({ onChange: { debounce: 400, autoSubmit: true } })

      expect(result).toEqual({
        validation: "onChange",
        debounce: 400,
        autoSubmit: true,
      })
    })

    it("parses onChange with Duration object", () => {
      const result = parse({ onChange: { debounce: "1 second" } })

      expect(result).toEqual({
        validation: "onChange",
        debounce: 1000,
        autoSubmit: false,
      })
    })

    it("parses onChange with zero debounce", () => {
      const result = parse({ onChange: { debounce: 0 } })

      expect(result).toEqual({
        validation: "onChange",
        debounce: 0,
        autoSubmit: false,
      })
    })
  })
})
