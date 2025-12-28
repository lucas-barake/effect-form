/**
 * Validation utilities for form error handling.
 */
import * as Option from "effect/Option"
import * as ParseResult from "effect/ParseResult"
import { schemaPathToFieldPath } from "./Path.js"

/**
 * Extracts the first error message from a ParseError.
 *
 * @category Error Handling
 */
export const extractFirstError = (error: ParseResult.ParseError): Option.Option<string> => {
  const issues = ParseResult.ArrayFormatter.formatErrorSync(error)
  if (issues.length === 0) {
    return Option.none()
  }
  return Option.some(issues[0].message)
}

/**
 * Routes validation errors from a ParseError to a map of field paths to error messages.
 * Used for cross-field validation where schema errors need to be displayed on specific fields.
 *
 * @category Error Handling
 */
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
