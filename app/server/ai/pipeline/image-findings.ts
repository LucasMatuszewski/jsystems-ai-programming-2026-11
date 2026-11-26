import "server-only"

import type { DecisionSignals, ImageFindings, SignalAnswer } from "@/lib/schemas"

// ADR-001 4.4: on the rule and fast routes `imageFindings` is derived
// deterministically from the signals, with Polish labels for each choice value.

/**
 * Used when signals are unavailable (ADR-001 A1: the endpoint currently always fails).
 * The date rule (R-4 / C-2) does not depend on the photo, so a rule-route decision
 * stays valid with these neutral findings; nothing here claims the photo was reviewed.
 */
export const NEUTRAL_FINDINGS: ImageFindings = {
  deviceVisible: true,
  categoryMatches: true,
  photoQuality: "limited",
  damage: "Brak automatycznej oceny zdjęcia.",
  signsOfUse: null,
  likelyCause: null,
  evidence: ["Zdjęcie nie zostało ocenione automatycznie."],
  contradictsDescription: false,
}

const DAMAGE_TYPES: Record<string, string> = {
  none: "brak widocznych uszkodzeń",
  crack: "pęknięcie",
  scratch_or_scuff: "zarysowania lub otarcia",
  dent_or_bend: "wgniecenie lub wygięcie",
  liquid: "ślady zalania",
  burn_or_melt: "ślady przypalenia lub stopienia",
  screen_defect: "wada ekranu",
  swelling: "spęcznienie",
  opened_or_modified: "ślady otwierania lub modyfikacji",
  other: "inne uszkodzenie",
}
const DAMAGE_LOCATIONS: Record<string, string> = {
  none: "brak",
  screen: "ekran",
  housing: "obudowa",
  keyboard_or_buttons: "klawiatura lub przyciski",
  hinge: "zawias",
  port: "port",
  battery_area: "okolice baterii",
  other: "inne miejsce",
}
const CONDITIONS: Record<number, string> = {
  1: "zepsuty",
  2: "wyraźnie uszkodzony",
  3: "widoczne zużycie",
  4: "niewielkie zużycie",
  5: "jak nowy",
}
const CAUSES: Record<string, ImageFindings["likelyCause"]> = {
  manufacturing_defect: "manufacturing_defect",
  user_caused: "user_caused",
  undetermined: "undetermined",
}
const CAUSE_LABELS: Record<string, string> = {
  manufacturing_defect: "wada fabryczna",
  user_caused: "uszkodzenie z winy użytkownika",
  undetermined: "przyczyna nieustalona",
  no_defect_visible: "brak widocznej wady",
}

const pct = (a: SignalAnswer) => `${Math.round(a.confidence * 100)}%`
const yes = (a: SignalAnswer | undefined) => a?.value === true
const no = (a: SignalAnswer | undefined) => a?.value === false

export function findingsFromSignals(signals: DecisionSignals, threshold: number): ImageFindings {
  if (signals.status !== "ok") return NEUTRAL_FINDINGS
  const a = signals.answers
  const usable = a.photo_usable
  const photoQuality: ImageFindings["photoQuality"] = no(usable)
    ? "unusable"
    : yes(usable) && usable!.confidence >= threshold
      ? "good"
      : "limited"

  const evidence: string[] = []
  if (usable) evidence.push(`Zdjęcie ${yes(usable) ? "nadaje się do oceny" : "nie nadaje się do oceny"} (pewność ${pct(usable)}).`)
  if (a.device_visible) evidence.push(`Urządzenie ${yes(a.device_visible) ? "jest widoczne" : "nie jest widoczne"} (pewność ${pct(a.device_visible)}).`)
  if (a.category_match) evidence.push(`Zdjęcie ${yes(a.category_match) ? "zgadza się" : "nie zgadza się"} z kategorią (pewność ${pct(a.category_match)}).`)
  const type = a.damage_type
  const location = a.damage_location
  if (type) evidence.push(`Rodzaj uszkodzenia: ${DAMAGE_TYPES[String(type.value)] ?? String(type.value)} (pewność ${pct(type)}).`)
  if (location) evidence.push(`Miejsce uszkodzenia: ${DAMAGE_LOCATIONS[String(location.value)] ?? String(location.value)} (pewność ${pct(location)}).`)
  const condition = a.condition
  if (condition) evidence.push(`Stan: ${CONDITIONS[Number(condition.value)] ?? String(condition.value)} (pewność ${pct(condition)}).`)
  const cause = a.damage_cause
  if (cause) evidence.push(`Prawdopodobna przyczyna: ${CAUSE_LABELS[String(cause.value)] ?? String(cause.value)} (pewność ${pct(cause)}).`)
  if (evidence.length === 0) evidence.push(...NEUTRAL_FINDINGS.evidence)

  const damage = no(a.damage_visible)
    ? DAMAGE_TYPES.none!
    : type
      ? `${DAMAGE_TYPES[String(type.value)] ?? String(type.value)}${location && location.value !== "none" ? ` (${DAMAGE_LOCATIONS[String(location.value)] ?? String(location.value)})` : ""}`
      : NEUTRAL_FINDINGS.damage

  return {
    deviceVisible: a.device_visible ? yes(a.device_visible) : true,
    categoryMatches: a.category_match ? yes(a.category_match) : true,
    photoQuality,
    damage: damage!,
    signsOfUse: a.signs_of_use ? (yes(a.signs_of_use) ? "Widoczne ślady użytkowania." : "Brak widocznych śladów użytkowania.") : null,
    likelyCause: cause ? (CAUSES[String(cause.value)] ?? null) : null,
    evidence,
    contradictsDescription: no(a.description_consistent),
  }
}
