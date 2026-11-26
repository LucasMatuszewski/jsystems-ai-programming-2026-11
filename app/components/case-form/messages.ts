import { pl, type PlErrorCode } from "@/lib/i18n/pl"

/** Polish text for an error code; unknown codes fall back to the generic message. */
export function errorText(code: string): string {
  return code in pl.errors ? pl.errors[code as PlErrorCode] : pl.errors.generic
}
