/**
 * One plain email address: exactly one @, text on both sides, and none of the
 * characters a mail library reads as list, group, display-name or comment
 * syntax. nodemailer parses a `to` string like "a@x, b@y" or "Pal <b@y>" as
 * several or different recipients, so any value checked against suppressions
 * or limits must pass this first, or the checked value and the delivered
 * recipients can differ.
 */
// Control characters (U+0000-U+001F, U+007F) are excluded too: nodemailer's
// parser silently drops them, so "opted\u0001out@x" would be checked as one
// address and delivered to another.
export const SINGLE_ADDRESS_REGEX = /^[^\s@,;<>"():\\\x00-\x1f\x7f]+@[^\s@,;<>"():\\\x00-\x1f\x7f]+$/

export function isSingleEmailAddress(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && SINGLE_ADDRESS_REGEX.test(value)
}
