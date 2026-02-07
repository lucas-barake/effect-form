import * as Option from "effect/Option"
import * as ParseResult from "effect/ParseResult"
import type * as AST from "effect/SchemaAST"
import { schemaPathToFieldPath } from "./Path.ts"

export type ErrorSource = "field" | "refinement"

export interface ErrorEntry {
  readonly message: string
  readonly source: ErrorSource
}

interface IssueSourceEntry {
  readonly path: ReadonlyArray<PropertyKey>
  readonly source: ErrorSource
  readonly issue: ParseResult.ParseIssue
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

const collectIssueSources = (error: ParseResult.ParseError): ReadonlyArray<IssueSourceEntry> => {
  const entries: Array<IssueSourceEntry> = []

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
      case "Forbidden":
        entries.push({ path, source, issue })
        break
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
  return entries
}

const getIssueMessage = (issue: ParseResult.ParseIssue): string | undefined => {
  const formatted = ParseResult.ArrayFormatter.formatIssueSync(issue)
  return formatted[0]?.message
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

export const routeErrorsWithSource = (error: ParseResult.ParseError): Map<string, ErrorEntry> => {
  const result = new Map<string, ErrorEntry>()
  const formattedIssues = ParseResult.ArrayFormatter.formatErrorSync(error)
  const issueSources = collectIssueSources(error)
  const messageSources = new Map<string, ErrorSource>()
  const refinementPaths = new Set<string>()

  for (const entry of issueSources) {
    const fieldPath = schemaPathToFieldPath(entry.path) ?? ""
    const message = getIssueMessage(entry.issue)
    if (message !== undefined) {
      const messageKey = `${fieldPath}::${message}`
      const existing = messageSources.get(messageKey)
      if (!existing || (existing === "field" && entry.source === "refinement")) {
        messageSources.set(messageKey, entry.source)
      }
    }
    if (entry.source === "refinement") {
      refinementPaths.add(fieldPath)
    }
  }

  for (const issue of formattedIssues) {
    const fieldPath = schemaPathToFieldPath(issue.path) ?? ""
    if (result.has(fieldPath)) continue
    const preferredSource: ErrorSource = refinementPaths.has(fieldPath) ? "refinement" : "field"
    const messageKey = `${fieldPath}::${issue.message}`
    const issueSource = messageSources.get(messageKey) ?? "field"
    if (preferredSource === "refinement" && issueSource !== "refinement") {
      continue
    }
    result.set(fieldPath, { message: issue.message, source: issueSource })
  }

  if (result.size < formattedIssues.length) {
    for (const issue of formattedIssues) {
      const fieldPath = schemaPathToFieldPath(issue.path) ?? ""
      if (result.has(fieldPath)) continue
      const messageKey = `${fieldPath}::${issue.message}`
      const issueSource = messageSources.get(messageKey) ?? "field"
      result.set(fieldPath, { message: issue.message, source: issueSource })
    }
  }

  return result
}
