import "server-only"

import { isValidIsoDate, todayInWarsaw } from "@/lib/dates"

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

/** Counts calendar-day boundaries in Europe/Warsaw; the purchase date is day zero. */
export function daysSincePurchase(purchaseDate: string, now: Date): number {
  if (!isValidIsoDate(purchaseDate)) {
    throw new RangeError(`Invalid purchase date: ${purchaseDate}`)
  }

  const today = todayInWarsaw(now)
  const purchaseDay = Date.parse(`${purchaseDate}T00:00:00.000Z`)
  const todayDay = Date.parse(`${today}T00:00:00.000Z`)

  return (todayDay - purchaseDay) / MILLISECONDS_PER_DAY
}
