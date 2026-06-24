import * as Option from "effect/Option"
import type * as Schema from "effect/Schema"
import * as SchemaIssue from "effect/SchemaIssue"
import { schemaPathToFieldPath } from "./Path.ts"

export type ErrorSource = "field" | "refinement"

export interface ErrorEntry {
  readonly message: string
  readonly source: ErrorSource
}

interface IssueSourceEntry {
  readonly path: ReadonlyArray<PropertyKey>
  readonly source: ErrorSource
  readonly issue: SchemaIssue.Issue
}

const standardFormatter = SchemaIssue.makeFormatterStandardSchemaV1()

const collectIssueSources = (error: Schema.SchemaError): ReadonlyArray<IssueSourceEntry> => {
  const entries: Array<IssueSourceEntry> = []

  const walk = (issue: SchemaIssue.Issue, path: ReadonlyArray<PropertyKey>, source: ErrorSource): void => {
    switch (issue._tag) {
      case "Filter":
        if (path.length === 0) {
          walk(issue.issue, path, "refinement")
        } else {
          walk(issue.issue, path, source)
        }
        break
      case "Encoding":
        if (path.length === 0) {
          walk(issue.issue, path, "refinement")
        } else {
          walk(issue.issue, path, source)
        }
        break
      case "Pointer":
        walk(issue.issue, [...path, ...issue.path], source)
        break
      case "Composite":
        for (const sub of issue.issues) {
          walk(sub, path, source)
        }
        break
      case "AnyOf":
        for (const sub of issue.issues) {
          walk(sub, path, source)
        }
        break
      case "InvalidType":
      case "InvalidValue":
      case "MissingKey":
      case "UnexpectedKey":
      case "Forbidden":
      case "OneOf":
        entries.push({ path, source, issue })
        break
    }
  }

  walk(error.issue, [], "field")
  return entries
}

const getIssueMessage = (issue: SchemaIssue.Issue): string | undefined => {
  const formatted = standardFormatter(issue)
  return formatted.issues[0]?.message
}

export const extractFirstError = (error: Schema.SchemaError): Option.Option<string> => {
  const formatted = standardFormatter(error.issue)
  if (formatted.issues.length === 0) {
    return Option.none()
  }
  const issue = formatted.issues[0]
  return issue === undefined ? Option.none() : Option.some(issue.message)
}

const normalizePath = (
  path: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }> | undefined
): ReadonlyArray<PropertyKey> => {
  if (!path) return []
  return path.map((segment) =>
    typeof segment === "object" && segment !== null && "key" in segment ? segment.key : segment as PropertyKey
  )
}

export const routeErrors = (error: Schema.SchemaError): Map<string, string> => {
  const result = new Map<string, string>()
  const formatted = standardFormatter(error.issue)

  for (const issue of formatted.issues) {
    const fieldPath = schemaPathToFieldPath(normalizePath(issue.path))
    if (fieldPath && !result.has(fieldPath)) {
      result.set(fieldPath, issue.message)
    }
  }

  return result
}

export const routeErrorsWithSource = (error: Schema.SchemaError): Map<string, ErrorEntry> => {
  const result = new Map<string, ErrorEntry>()
  const formattedIssues = standardFormatter(error.issue).issues
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
    const fieldPath = schemaPathToFieldPath(normalizePath(issue.path)) ?? ""
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
      const fieldPath = schemaPathToFieldPath(normalizePath(issue.path)) ?? ""
      if (result.has(fieldPath)) continue
      const messageKey = `${fieldPath}::${issue.message}`
      const issueSource = messageSources.get(messageKey) ?? "field"
      result.set(fieldPath, { message: issue.message, source: issueSource })
    }
  }

  return result
}
