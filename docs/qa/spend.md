# OpenRouter spend log

Cumulative spend cap for the whole implementation: **USD 5** (ADR-006 §3.4). When the cumulative total reaches USD 4.50, work stops and the user is asked. Usage is the key's all-time `usage` from `pnpm openrouter:status`; the cumulative column counts spend since the baseline.

| Date | Activity | Usage before (USD) | Usage after (USD) | Delta (USD) | Cumulative (USD) |
|---|---|---|---|---|---|
| 2026-11-26 | T03/T04 baseline (status check only, before the first real chat call) | 0.0040 | 0.0040 | 0.0000 | 0.0000 |
| 2026-11-26 | T03 real chat smoke (1 request, `openai/gpt-6-luna`, one-word reply) | 0.0040 | 0.0040 | 0.0000 | 0.0000 |
| 2026-11-26 | T06 Luna Decisions recordings (2 real calls failed upstream 401 account_deactivated; 401-invalid-key and closed-port cases cost nothing) | 0.0040 | 0.0040 | 0.0000 | 0.0000 |
| 2026-11-26 | G1 gate (7 real chat turns, `openai/gpt-6-luna`: 6 prod + 1 dev; drift check crashed before any call) | 0.0040 | 0.0040 | 0.0000 | 0.0000 |
| 2026-11-26 | T13 LLM recordings (8 real HTTP requests, `openai/gpt-6-luna`: 2 escalated, 2 writer, chat-plain, chat-tool-update 2 steps; plus 1 invalid-key 401 that costs nothing) | 0.0040 | 0.0043 | 0.0003 | 0.0003 |
| 2026-11-26 | G1 re-check (drift check live call returned 200 + 3 real chat turns on prod, `openai/gpt-6-luna`; all upstream lines costUsd 0) | 0.0048 | 0.0048 | 0.0000 | 0.0003 |
| 2026-11-26 | T06b Luna Decisions success recordings (4 decisions + 1 refusal attempt + 1 compare = 6 real calls, `openai/gpt-6-luna-decisions`; BYOK route, `usage.cost` 0, upstream about USD 0.0002 per call not billed to the key) | 0.0048 | 0.0048 | 0.0000 | 0.0003 |
| 2026-11-26 | T06c Jev 1.14 decision recordings (4 decisions + 1 refusal attempt + 1 compare = 6 real calls, `typesafe/jev-1.14`; BYOK route, `usage.cost` 0, upstream about USD 0.0007 for the 4 recordings, not billed to the key) | 0.0048 | 0.0048 | 0.0000 | 0.0003 |
| 2026-11-26 | T18 /api/cases recordings (8 HTTP requests: 5 real submissions with `typesafe/jev-1.14` + `openai/gpt-6-luna`, 1 invalid-key instance with 2 failed upstream calls, 2 rejected before any upstream call; BYOK route, `usage.cost` 0) | 0.0048 | 0.0048 | 0.0000 | 0.0003 |
| 2026-11-26 | T22 wiring: desktop E2E (return, complaint, date-rule x2, session; plus two killed runs of about 15 min that kept submitting), mobile session, 1 manual submission; `typesafe/jev-1.14` + `openai/gpt-6-luna` | 0.0086 | 0.1115 | 0.1029 | 0.1115 |
| 2026-11-26 | G2 gate (6 valid real submissions + 1 invalid-key failure with 1 retry; `typesafe/jev-1.14` + `openai/gpt-6-luna`; BYOK, all upstream costUsd 0) | 0.1115 | 0.1115 | 0.0000 | 0.1115 |
| 2026-11-26 | T24 /api/chat recordings (5 HTTP requests: plain 1 step, update 2 steps, insist 1 step, invalid-key instance 1 failed upstream, 400 with none; `openai/gpt-6-luna`; BYOK, usage unchanged) | 0.1115 | 0.1115 | 0.0000 | 0.1115 |
| 2026-11-26 | T25 chat UI: desktop E2E chat.spec (4 real chat requests, 1 case) + responsive-a11y (2 cases) + mobile collapsed (1 case) + manual check (1 case, 4 chat turns); `openai/gpt-6-luna`, `typesafe/jev-1.14`; BYOK, usage unchanged | 0.1115 | 0.1115 | 0.0000 | 0.1115 |
| 2026-11-26 | G3 gate (2 real submissions + 22 real chat requests incl. 1 Ponów, 2 with update_recommendation = 24 chat-step calls; `openai/gpt-6-luna`, `typesafe/jev-1.14`; BYOK, all costUsd 0) | 0.1115 | 0.1115 | 0.0000 | 0.1115 |
| 2026-11-26 | G3-D1 fix check (1 real submission + 2 real chat requests = 2 chat-step calls, no tool call) + desktop E2E chat.spec (5 tests, 5 cases; real chat requests); `openai/gpt-6-luna`, `typesafe/jev-1.14`; BYOK, usage not re-measured (costUsd 0) | 0.1115 | 0.1115 | 0.0000 | 0.1115 |
