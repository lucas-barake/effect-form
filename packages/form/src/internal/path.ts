/**
 * Internal path utilities for form field operations.
 *
 * @internal
 */

const BRACKET_NOTATION_REGEX = /\[(\d+)\]/g

/**
 * Converts a schema path array to a dot/bracket notation string.
 *
 * @example
 * schemaPathToFieldPath(["items", 0, "name"]) // "items[0].name"
 */
export const schemaPathToFieldPath = (path: ReadonlyArray<PropertyKey>): string => {
  if (path.length === 0) return ""

  let result = String(path[0])
  for (let i = 1; i < path.length; i++) {
    const segment = path[i]
    if (typeof segment === "number") {
      result += `[${segment}]`
    } else {
      result += `.${String(segment)}`
    }
  }
  return result
}

/**
 * Checks if a field path or any of its parent paths are in the dirty set.
 */
export const isPathOrParentDirty = (dirtyFields: ReadonlySet<string>, path: string): boolean => {
  if (dirtyFields.has(path)) return true

  let parent = path
  while (true) {
    const lastDot = parent.lastIndexOf(".")
    const lastBracket = parent.lastIndexOf("[")
    const splitIndex = Math.max(lastDot, lastBracket)

    if (splitIndex === -1) break

    parent = parent.substring(0, splitIndex)
    if (dirtyFields.has(parent)) return true
  }

  return false
}

/**
 * Gets a nested value from an object using dot/bracket notation path.
 *
 * @example
 * getNestedValue({ items: [{ name: "A" }] }, "items[0].name") // "A"
 */
export const getNestedValue = (obj: unknown, path: string): unknown => {
  if (path === "") return obj
  const parts = path.replace(BRACKET_NOTATION_REGEX, ".$1").split(".")
  let current: unknown = obj
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

/**
 * Sets a nested value in an object immutably using dot/bracket notation path.
 *
 * @example
 * setNestedValue({ items: [{ name: "A" }] }, "items[0].name", "B")
 * // { items: [{ name: "B" }] }
 */
export const setNestedValue = <T>(obj: T, path: string, value: unknown): T => {
  if (path === "") return value as T
  const parts = path.replace(BRACKET_NOTATION_REGEX, ".$1").split(".")
  const result = { ...obj } as Record<string, unknown>

  let current = result
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (Array.isArray(current[part])) {
      current[part] = [...(current[part] as Array<unknown>)]
    } else {
      current[part] = { ...(current[part] as Record<string, unknown>) }
    }
    current = current[part] as Record<string, unknown>
  }

  current[parts[parts.length - 1]] = value
  return result as T
}
