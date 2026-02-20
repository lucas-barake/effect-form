---
"@lucas-barake/effect-form": minor
"@lucas-barake/effect-form-react": minor
---

Migrate to Effect v4 beta

- Update all Schema APIs: `Schema.Schema.Any` → `Schema.Top`, `Schema.Schema.Encoded` → `Schema.Codec.Encoded`, `Schema.Schema.Context` → `Schema.Codec.DecodingServices`
- Update SchemaAST tag names: `StringKeyword` → `String`, `NumberKeyword` → `Number`, `BooleanKeyword` → `Boolean`, `NeverKeyword` → `Never`, `TypeLiteral` → `Objects`, `TupleType` → `Arrays`, `Enums` → `Enum`
- Replace `ParseResult.ParseError` with `Schema.SchemaError` throughout
- Replace `Schema.decodeUnknown` with `Schema.decodeUnknownEffect`
- Replace `Cause.failureOption` with `Cause.findErrorOption`
- Replace `Schema.filter`/`Schema.filterEffect` with `Schema.check(Schema.makeFilter(...))` and `Schema.decode({ decode: SchemaGetter.checkEffect(...), encode: SchemaGetter.passthrough() })`
- Rewrite `Validation.ts` issue tree walker for v4 issue types (`Filter`, `Encoding`, `AnyOf`, `InvalidType`, etc.)
- Update formatter to `SchemaIssue.makeFormatterStandardSchemaV1()`
- Remove `Utils.structuralRegion` (structural equality is default in v4)
- Update atom imports from `@effect-atom/atom` to `effect/unstable/reactivity/Atom`
- Update atom-react imports from `@effect-atom/atom-react` to `@effect/atom-react`
- Drop React 18 support (v4 atom-react requires React 19)
