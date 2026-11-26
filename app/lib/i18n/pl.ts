/** Single source of all user-facing Polish strings (AC-44). */
export const pl = {
  appName: "Hardware Service Decision Copilot",
  disclaimer:
    "To jest wstępna rekomendacja wygenerowana automatycznie, a nie ostateczna decyzja. Ostateczną decyzję podejmie dział obsługi klienta po weryfikacji zgłoszenia.",

  form: {
    title: "Zgłoś zwrot lub reklamację",
    intro: "Opisz sprawę i dodaj zdjęcie. Asystent AI przygotuje wstępną rekomendację.",
    submit: "Wyślij zgłoszenie",
  },
  submit: "Wyślij zgłoszenie",

  caseTypes: {
    return: { label: "Zwrot", subtitle: "Nie chcę już urządzenia" },
    complaint: { label: "Reklamacja", subtitle: "Urządzenie jest wadliwe" },
  },
  categories: {
    laptop: "Laptop",
    smartphone: "Smartfon",
    tablet: "Tablet",
    desktop: "Komputer stacjonarny",
    monitor: "Monitor",
    tv: "Telewizor",
    audio: "Słuchawki / Audio",
    wearable: "Smartwatch / Urządzenie noszone",
    other: "Inne",
  },
  labels: {
    caseType: "Rodzaj zgłoszenia",
    category: "Kategoria sprzętu",
    model: "Nazwa / model urządzenia",
    purchaseDate: "Data zakupu",
    reason: "Powód zgłoszenia",
    photo: "Zdjęcie urządzenia",
    requiredMarker: "*",
    categoryPlaceholder: "Wybierz kategorię",
  },
  placeholders: {
    model: "np. Lenovo ThinkPad X1",
    reason: {
      return: "Powód zwrotu (opcjonalnie)",
      complaint: "Opisz, co się stało i kiedy zauważyłeś problem",
    },
  },
  photoHints: {
    return: "Pokaż całe urządzenie w dobrym świetle",
    complaint: "Pokaż wyraźnie uszkodzenie lub wadę",
  },
  photo: {
    dropzone: "Przeciągnij zdjęcie tutaj lub kliknij, aby wybrać plik",
    change: "Zmień zdjęcie",
  },
  changePhoto: "Zmień zdjęcie",
  personalDataNote: "Nie umieszczaj na zdjęciu danych osobowych.",
  consent:
    "Rozumiem, że zdjęcie i opis zostaną przeanalizowane przez system AI, a wynik jest wstępną rekomendacją.",

  errors: {
    required: "To pole jest wymagane.",
    model_length: "Nazwa lub model musi mieć od 2 do 100 znaków.",
    date_future: "Data zakupu nie może być z przyszłości.",
    date_too_old: "Data zakupu jest zbyt odległa.",
    reason_too_short: "Opisz problem w co najmniej 20 znakach.",
    reason_too_long: "Opis może mieć maksymalnie 2000 znaków.",
    consent_required: "Zgoda jest wymagana, aby wysłać zgłoszenie.",
    invalid_option: "Wybierz jedną z dostępnych opcji.",
    file_too_large: "Plik przekracza limit 10 MB.",
    unsupported_media_type: "Dozwolone formaty: JPG, PNG, WebP.",
    validation_failed: "Popraw zaznaczone pola i spróbuj ponownie.",
    server_misconfigured: "Usługa jest chwilowo niedostępna. Spróbuj ponownie później.",
    generic: "Coś poszło nie tak. Spróbuj ponownie za chwilę.",
  },

  progress: ["Przesyłanie zdjęcia…", "Analiza zdjęcia…", "Przygotowanie rekomendacji…"],

  analysisFailed: {
    banner: "Nie udało się przeanalizować zgłoszenia. Spróbuj ponownie za chwilę.",
    retry: "Spróbuj ponownie",
  },

  chat: {
    errorMessage: "Nie udało się wysłać odpowiedzi.",
    retry: "Ponów",
    inputPlaceholder: "Zadaj pytanie lub dodaj informacje…",
    send: "Wyślij",
    updatingRecommendation: "Aktualizuję rekomendację…",
    storageFailed: "Nie udało się zapisać rozmowy w przeglądarce.",
  },
  updatedRecommendation: "Zaktualizowana rekomendacja",

  newCase: {
    button: "Nowe zgłoszenie",
    confirm: "Rozpocząć nowe zgłoszenie? Obecna rozmowa zostanie usunięta.",
    confirmButton: "Rozpocznij nowe",
    cancelButton: "Anuluj",
  },

  summary: {
    caseType: "Rodzaj zgłoszenia",
    category: "Kategoria",
    model: "Model",
    purchaseDate: "Data zakupu",
    daysSincePurchase: "Dni od zakupu",
    photo: "Zdjęcie",
    currentDecision: "Aktualna rekomendacja",
  },

  decisions: {
    Akceptacja: "Akceptacja",
    Odrzucenie: "Odrzucenie",
    "Weryfikacja ręczna": "Weryfikacja ręczna",
  },
  remedies: {
    repair: "Naprawa",
    replacement: "Wymiana",
  },
} as const

export type PlErrorCode = keyof typeof pl.errors
