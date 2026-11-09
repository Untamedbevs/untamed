/**
 * Quote a value for a PostgREST `or(...)` / logic filter so commas,
 * parentheses, and dots in it (valid in email addresses) aren't parsed as
 * filter syntax.
 */
export function quoteFilterValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
