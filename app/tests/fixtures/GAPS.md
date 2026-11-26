# Uncaptured cases (ADR-006 3.1)

Not provoked, so there is no recording. They are covered only through the generic error path exercised by the real 401 and connection-failure recordings.

| Case | Reason |
|---|---|
| OpenRouter 402 (insufficient credit) | not provoked per ADR-006 §3.1 |
| OpenRouter 429 (rate limit) | not provoked per ADR-006 §3.1 |
| OpenRouter 503 / upstream outage | not provoked per ADR-006 §3.1 |
| Mid-stream errors | not provoked per ADR-006 §3.1 |
| Own endpoint 413 (file > 10 MB) | no real photo exceeds 10 MB and generated files are forbidden |
| Successful Luna Decisions answers (4 cases) | BLOCKED: upstream returned 401 `account_deactivated` for the real key, see `openrouter/decisions/NOTES.md` |
| Decisions refusal (`type: "refusal"`) | not attempted: the success path was unavailable (budget kept) |
