import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useDebounced } from "../../src/internal/use-debounced.js"

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe("useDebounced", () => {
  describe("when delay is null", () => {
    it("returns original function and calls immediately", () => {
      const fn = vi.fn()
      const { result } = renderHook(() => useDebounced(fn, null))

      act(() => {
        result.current("arg1", "arg2")
      })

      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn).toHaveBeenCalledWith("arg1", "arg2")
    })

    it("does not debounce multiple calls", () => {
      const fn = vi.fn()
      const { result } = renderHook(() => useDebounced(fn, null))

      act(() => {
        result.current("call1")
        result.current("call2")
        result.current("call3")
      })

      expect(fn).toHaveBeenCalledTimes(3)
      expect(fn).toHaveBeenNthCalledWith(1, "call1")
      expect(fn).toHaveBeenNthCalledWith(2, "call2")
      expect(fn).toHaveBeenNthCalledWith(3, "call3")
    })
  })

  describe("when delay is 0", () => {
    it("calls immediately without debouncing", () => {
      const fn = vi.fn()
      const { result } = renderHook(() => useDebounced(fn, 0))

      act(() => {
        result.current("immediate")
      })

      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn).toHaveBeenCalledWith("immediate")
    })

    it("does not debounce multiple calls", () => {
      const fn = vi.fn()
      const { result } = renderHook(() => useDebounced(fn, 0))

      act(() => {
        result.current("call1")
        result.current("call2")
      })

      expect(fn).toHaveBeenCalledTimes(2)
    })
  })

  describe("when delay is positive", () => {
    it("debounces calls by the specified delay", async () => {
      vi.useFakeTimers()
      const fn = vi.fn()
      const { result } = renderHook(() => useDebounced(fn, 100))

      act(() => {
        result.current("debounced")
      })

      expect(fn).not.toHaveBeenCalled()

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn).toHaveBeenCalledWith("debounced")

      vi.useRealTimers()
    })

    it("cancels pending calls on new invocation", async () => {
      vi.useFakeTimers()
      const fn = vi.fn()
      const { result } = renderHook(() => useDebounced(fn, 100))

      act(() => {
        result.current("first")
      })

      await act(async () => {
        vi.advanceTimersByTime(50)
      })

      expect(fn).not.toHaveBeenCalled()

      act(() => {
        result.current("second")
      })

      await act(async () => {
        vi.advanceTimersByTime(50)
      })

      expect(fn).not.toHaveBeenCalled()

      await act(async () => {
        vi.advanceTimersByTime(50)
      })

      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn).toHaveBeenCalledWith("second")

      vi.useRealTimers()
    })

    it("only executes the last call when multiple calls are made rapidly", async () => {
      vi.useFakeTimers()
      const fn = vi.fn()
      const { result } = renderHook(() => useDebounced(fn, 100))

      act(() => {
        result.current("call1")
        result.current("call2")
        result.current("call3")
        result.current("call4")
      })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn).toHaveBeenCalledWith("call4")

      vi.useRealTimers()
    })
  })

  describe("cleanup on unmount", () => {
    it("cancels pending calls when component unmounts", async () => {
      vi.useFakeTimers()
      const fn = vi.fn()
      const { result, unmount } = renderHook(() => useDebounced(fn, 100))

      act(() => {
        result.current("pending")
      })

      expect(fn).not.toHaveBeenCalled()

      unmount()

      await act(async () => {
        vi.advanceTimersByTime(200)
      })

      expect(fn).not.toHaveBeenCalled()

      vi.useRealTimers()
    })
  })

  describe("function reference stability", () => {
    it("uses the latest function reference", async () => {
      vi.useFakeTimers()
      const fn1 = vi.fn()
      const fn2 = vi.fn()

      const { rerender, result } = renderHook(({ fn }) => useDebounced(fn, 100), {
        initialProps: { fn: fn1 },
      })

      act(() => {
        result.current("value")
      })

      // Update the function before debounce fires
      rerender({ fn: fn2 })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      expect(fn1).not.toHaveBeenCalled()
      expect(fn2).toHaveBeenCalledTimes(1)
      expect(fn2).toHaveBeenCalledWith("value")

      vi.useRealTimers()
    })

    it("returns stable debounced function when delay stays the same", () => {
      const fn = vi.fn()
      const { rerender, result } = renderHook(
        ({ delay }) => useDebounced(fn, delay),
        { initialProps: { delay: 100 } },
      )

      const firstRef = result.current

      rerender({ delay: 100 })

      expect(result.current).toBe(firstRef)
    })

    it("returns new debounced function when delay changes", () => {
      const fn = vi.fn()
      const { rerender, result } = renderHook(
        ({ delay }) => useDebounced(fn, delay),
        { initialProps: { delay: 100 } },
      )

      const firstRef = result.current

      rerender({ delay: 200 })

      expect(result.current).not.toBe(firstRef)
    })
  })

  describe("edge cases", () => {
    it("handles rapid delay changes gracefully", async () => {
      vi.useFakeTimers()
      const fn = vi.fn()

      const { rerender, result } = renderHook(
        ({ delay }) => useDebounced(fn, delay),
        { initialProps: { delay: 100 as number | null } },
      )

      act(() => {
        result.current("with-delay")
      })

      rerender({ delay: null })

      await act(async () => {
        vi.advanceTimersByTime(100)
      })

      act(() => {
        result.current("immediate")
      })

      expect(fn).toHaveBeenCalledWith("immediate")

      vi.useRealTimers()
    })

    it("preserves argument types", () => {
      const fn = vi.fn((_a: string, _b: number, _c: boolean) => {})
      const { result } = renderHook(() => useDebounced(fn, null))

      act(() => {
        result.current("string", 42, true)
      })

      expect(fn).toHaveBeenCalledWith("string", 42, true)
    })

    it("works with real timers", async () => {
      const fn = vi.fn()
      const { result } = renderHook(() => useDebounced(fn, 50))

      act(() => {
        result.current("real-timer")
      })

      expect(fn).not.toHaveBeenCalled()

      await act(async () => {
        await delay(60)
      })

      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn).toHaveBeenCalledWith("real-timer")
    })
  })
})
