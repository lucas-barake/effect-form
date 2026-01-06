import * as Option from "effect/Option"
import * as ParseResult from "effect/ParseResult"
import type * as AST from "effect/SchemaAST"
import { schemaPathToFieldPath } from "./Path.js"

export type ErrorSource = "field" | "refinement"

export interface ErrorEntry {
  readonly message: string
  readonly source: ErrorSource
}

const getBaseAST = (ast: AST.AST): AST.AST => {
  switch (ast._tag) {
    case "Refinement":
    case "Transformation":
      return getBaseAST(ast.from)
    default:
      return ast
  }
}

const isCompositeType = (ast: AST.AST): boolean => {
  const base = getBaseAST(ast)
  switch (base._tag) {
    case "TypeLiteral": // Schema.Struct
    case "TupleType": // Schema.Tuple
    case "Declaration": // Schema.Class, Schema.TaggedClass
    case "Union": // Schema.Union
    case "Suspend": // Recursive schemas
      return true
    default:
      return false
  }
}

export const extractFirstError = (error: ParseResult.ParseError): Option.Option<string> => {
  const issues = ParseResult.ArrayFormatter.formatErrorSync(error)
  if (issues.length === 0) {
    return Option.none()
  }
  return Option.some(issues[0].message)
}

export const routeErrors = (error: ParseResult.ParseError): Map<string, string> => {
  const result = new Map<string, string>()
  const issues = ParseResult.ArrayFormatter.formatErrorSync(error)

  for (const issue of issues) {
    const fieldPath = schemaPathToFieldPath(issue.path)
    if (fieldPath && !result.has(fieldPath)) {
      result.set(fieldPath, issue.message)
    }
  }

  return result
}

const determineErrorSources = (error: ParseResult.ParseError): Map<string, ErrorSource> => {
  const sources = new Map<string, ErrorSource>()

  const walk = (issue: ParseResult.ParseIssue, path: ReadonlyArray<PropertyKey>, source: ErrorSource): void => {
    switch (issue._tag) {
      case "Refinement":
        if (issue.kind === "Predicate" && isCompositeType(issue.ast.from) && path.length === 0) {
          walk(issue.issue, path, "refinement")
        } else {
          walk(issue.issue, path, source)
        }
        break
      case "Pointer": {
        const pointerPath = Array.isArray(issue.path) ? issue.path : [issue.path]
        walk(issue.issue, [...path, ...pointerPath], source)
        break
      }
      case "Composite": {
        const issues = Array.isArray(issue.issues) ? issue.issues : [issue.issues]
        for (const sub of issues) {
          walk(sub, path, source)
        }
        break
      }
      case "Type":
      case "Missing":
      case "Unexpected":
      case "Forbidden": {
        const fieldPath = schemaPathToFieldPath(path)
        const key = fieldPath ?? ""
        if (!sources.has(key)) {
          sources.set(key, source)
        }
        break
      }
      case "Transformation":
        if (
          issue.kind === "Transformation" &&
          issue.ast.transformation._tag === "FinalTransformation" &&
          isCompositeType(issue.ast.from) &&
          path.length === 0
        ) {
          walk(issue.issue, path, "refinement")
        } else {
          walk(issue.issue, path, source)
        }
        break
    }
  }

  walk(error.issue, [], "field")
  return sources
}

export const routeErrorsWithSource = (error: ParseResult.ParseError): Map<string, ErrorEntry> => {
  const result = new Map<string, ErrorEntry>()
  const formattedIssues = ParseResult.ArrayFormatter.formatErrorSync(error)
  const sources = determineErrorSources(error)

  for (const issue of formattedIssues) {
    const fieldPath = schemaPathToFieldPath(issue.path)
    const key = fieldPath ?? ""
    if (!result.has(key)) {
      const source = sources.get(key) ?? "field"
      result.set(key, { message: issue.message, source })
    }
  }

  return result
}
