---
"@lucas-barake/effect-form": patch
---

`Field.extractStructFieldDefs`, which React and Solid forms call when they are built, now throws when an array item schema decodes to a key its encoded struct does not have, such as a struct that renames keys or a JSON string decoded into a struct. Item fields read encoded values by key while schema errors use decoded keys, so such items showed empty inputs and errors on fields that held no value. The bindings used to fail with a misleading "Missing field component" error.
