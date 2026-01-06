import * as React from "react"

export const useDebounced = <T extends (...args: ReadonlyArray<any>) => void>(
  fn: T,
  delayMs: number | null,
): T => {
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const fnRef = React.useRef(fn)

  React.useEffect(() => {
    fnRef.current = fn
  })

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return React.useMemo(
    () =>
      ((...args: Parameters<T>) => {
        if (delayMs === null || delayMs === 0) {
          fnRef.current(...args)
          return
        }
        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current)
        }
        timeoutRef.current = setTimeout(() => {
          fnRef.current(...args)
          timeoutRef.current = null
        }, delayMs)
      }) as T,
    [delayMs],
  )
}
