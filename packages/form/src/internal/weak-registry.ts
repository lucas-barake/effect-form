export interface WeakRegistry<V extends object> {
  readonly get: (key: string) => V | undefined
  readonly set: (key: string, value: V) => void
  readonly delete: (key: string) => boolean
  readonly clear: () => void
  readonly values: () => IterableIterator<V>
}

export const createWeakRegistry = <V extends object>(): WeakRegistry<V> => {
  if (typeof WeakRef === "undefined" || typeof FinalizationRegistry === "undefined") {
    const map = new Map<string, V>()
    return {
      get: (key) => map.get(key),
      set: (key, value) => {
        map.set(key, value)
      },
      delete: (key) => map.delete(key),
      clear: () => map.clear(),
      values: () => map.values(),
    }
  }

  const map = new Map<string, WeakRef<V>>()
  const registry = new FinalizationRegistry<string>((key) => {
    map.delete(key)
  })

  return {
    get: (key) => map.get(key)?.deref(),
    set: (key, value) => {
      map.set(key, new WeakRef(value))
      registry.register(value, key)
    },
    delete: (key) => map.delete(key),
    clear: () => map.clear(),
    *values() {
      for (const ref of map.values()) {
        const value = ref.deref()
        if (value !== undefined) yield value
      }
    },
  }
}
