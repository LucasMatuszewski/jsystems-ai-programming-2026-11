import { describe, expect, it } from "vitest"
import { pl } from "@/lib/i18n/pl"
import { CATEGORIES, DECISIONS, REMEDIES } from "@/lib/schemas"

describe("pl strings", () => {
  it("has the exact AC-29 disclaimer", () => {
    expect(pl.disclaimer).toBe(
      "To jest wstępna rekomendacja wygenerowana automatycznie, a nie ostateczna decyzja. Ostateczną decyzję podejmie dział obsługi klienta po weryfikacji zgłoszenia.",
    )
  })
  it("lists categories in AC-03 order", () => {
    expect(CATEGORIES.map((c) => pl.categories[c])).toEqual([
      "Laptop",
      "Smartfon",
      "Tablet",
      "Komputer stacjonarny",
      "Monitor",
      "Telewizor",
      "Słuchawki / Audio",
      "Smartwatch / Urządzenie noszone",
      "Inne",
    ])
  })
  it("has exact validation and consent texts", () => {
    expect(pl.errors.date_future).toBe("Data zakupu nie może być z przyszłości.")
    expect(pl.errors.date_too_old).toBe("Data zakupu jest zbyt odległa.")
    expect(pl.errors.file_too_large).toBe("Plik przekracza limit 10 MB.")
    expect(pl.errors.unsupported_media_type).toBe("Dozwolone formaty: JPG, PNG, WebP.")
    expect(pl.consent).toBe(
      "Rozumiem, że zdjęcie i opis zostaną przeanalizowane przez system AI, a wynik jest wstępną rekomendacją.",
    )
  })
  it("covers every form error code", () => {
    for (const code of ["required", "model_length", "date_future", "date_too_old", "reason_too_short", "reason_too_long", "consent_required", "invalid_option"]) {
      expect(pl.errors).toHaveProperty(code)
    }
  })
  it("labels every decision and remedy", () => {
    for (const d of DECISIONS) expect(pl.decisions[d]).toBeTruthy()
    for (const r of REMEDIES) expect(pl.remedies[r]).toBeTruthy()
  })
  it("has the key UI texts", () => {
    expect(pl.submit).toBe("Wyślij zgłoszenie")
    expect(pl.appName).toBe("Hardware Service Decision Copilot")
    expect(pl.progress).toEqual(["Przesyłanie zdjęcia…", "Analiza zdjęcia…", "Przygotowanie rekomendacji…"])
    expect(pl.newCase.confirm).toBe("Rozpocząć nowe zgłoszenie? Obecna rozmowa zostanie usunięta.")
    expect(pl.chat.errorMessage).toBe("Nie udało się wysłać odpowiedzi.")
    expect(pl.chat.inputPlaceholder).toBe("Zadaj pytanie lub dodaj informacje…")
  })
})
