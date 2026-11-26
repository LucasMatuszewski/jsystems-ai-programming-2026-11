const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Today's date (YYYY-MM-DD) in Europe/Warsaw. */
export function todayInWarsaw(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  return `${get("year")}-${get("month")}-${get("day")}`
}

export function isValidIsoDate(value: string): boolean {
  const m = ISO_DATE.exec(value)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
}

/** Adds (or subtracts) whole years; 29 Feb clamps to 28 Feb in non-leap years. */
export function addYears(isoDate: string, years: number): string {
  const m = ISO_DATE.exec(isoDate)
  if (!m) throw new Error(`Invalid ISO date: ${isoDate}`)
  const y = Number(m[1]) + years
  const mo = Number(m[2])
  let d = Number(m[3])
  const lastDay = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  if (d > lastDay) d = lastDay
  return `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

/** ISO date (YYYY-MM-DD) as dd.mm.yyyy, the format shown in the panel. */
export function formatPlDate(isoDate: string): string {
  const m = ISO_DATE.exec(isoDate)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : isoDate
}
