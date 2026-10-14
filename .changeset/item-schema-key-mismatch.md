---
"@lucas-barake/effect-form": patch
---

Building a form now fails with a clear error when an array item schema has different keys when encoded and decoded, such as a struct that renames keys or a JSON string decoded into a struct. Item fields read encoded values by key while schema errors use decoded keys, so such items showed empty inputs and errors on fields that held no value. The bindings used to fail with a misleading "Missing field component" error.
