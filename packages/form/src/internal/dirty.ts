/**
 * Internal dirty tracking algorithms.
 *
 * @internal
 */
import * as Equal from "effect/Equal"
import * as Utils from "effect/Utils"
import { getNestedValue, isPathUnderRoot } from "./path.js"

/**
 * Recalculates dirty fields for an array after mutation.
 * Clears all paths under the array and re-evaluates each item.
 */
export const recalculateDirtyFieldsForArray = (
  dirtyFields: ReadonlySet<string>,
  initialValues: unknown,
  arrayPath: string,
  newItems: ReadonlyArray<unknown>,
): ReadonlySet<string> => {
  const initialItems = (getNestedValue(initialValues, arrayPath) ?? []) as ReadonlyArray<unknown>

  if (newItems === initialItems) {
    return dirtyFields
  }

  const nextDirty = new Set(
    Array.from(dirtyFields).filter((path) => !isPathUnderRoot(path, arrayPath)),
  )

  const loopLength = Math.max(newItems.length, initialItems.length)
  for (let i = 0; i < loopLength; i++) {
    const itemPath = `${arrayPath}[${i}]`
    const newItem = newItems[i]
    const initialItem = initialItems[i]

    if (newItem === initialItem) continue

    const isEqual = Utils.structuralRegion(() => Equal.equals(newItem, initialItem))
    if (!isEqual) {
      nextDirty.add(itemPath)
    }
  }

  if (newItems.length !== initialItems.length) {
    nextDirty.add(arrayPath)
  } else {
    nextDirty.delete(arrayPath)
  }

  return nextDirty
}

/**
 * Recalculates dirty fields for a subtree after value change.
 * Clears the rootPath and all children, then re-evaluates recursively.
 *
 * @param rootPath - Empty string for full form, or a specific path for targeted update
 */
export const recalculateDirtySubtree = (
  currentDirty: ReadonlySet<string>,
  allInitial: unknown,
  allValues: unknown,
  rootPath: string = "",
): ReadonlySet<string> => {
  const targetValue = rootPath ? getNestedValue(allValues, rootPath) : allValues
  const targetInitial = rootPath ? getNestedValue(allInitial, rootPath) : allInitial

  if (targetValue === targetInitial) {
    if (rootPath === "") {
      return new Set()
    }

    let changed = false
    const nextDirty = new Set(currentDirty)
    for (const path of currentDirty) {
      if (isPathUnderRoot(path, rootPath)) {
        nextDirty.delete(path)
        changed = true
      }
    }
    return changed ? nextDirty : currentDirty
  }

  const nextDirty = new Set(currentDirty)

  if (rootPath === "") {
    nextDirty.clear()
  } else {
    for (const path of nextDirty) {
      if (isPathUnderRoot(path, rootPath)) {
        nextDirty.delete(path)
      }
    }
  }

  const recurse = (current: unknown, initial: unknown, path: string): void => {
    if (current === initial) return

    if (Array.isArray(current)) {
      const initialArr = (initial ?? []) as ReadonlyArray<unknown>
      for (let i = 0; i < Math.max(current.length, initialArr.length); i++) {
        recurse(current[i], initialArr[i], path ? `${path}[${i}]` : `[${i}]`)
      }
    } else if (current !== null && typeof current === "object") {
      const initialObj = (initial ?? {}) as Record<string, unknown>
      for (const key in current as object) {
        recurse((current as Record<string, unknown>)[key], initialObj[key], path ? `${path}.${key}` : key)
      }
      for (const key in initialObj) {
        if (!(key in (current as object))) {
          recurse(undefined, initialObj[key], path ? `${path}.${key}` : key)
        }
      }
    } else {
      const isEqual = Utils.structuralRegion(() => Equal.equals(current, initial))
      if (!isEqual && path) nextDirty.add(path)
    }
  }

  recurse(targetValue, targetInitial, rootPath)
  return nextDirty
}
