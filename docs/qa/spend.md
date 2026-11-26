# OpenRouter spend log

Cumulative spend cap for the whole implementation: **USD 5** (ADR-006 §3.4). When the cumulative total reaches USD 4.50, work stops and the user is asked. Usage is the key's all-time `usage` from `pnpm openrouter:status`; the cumulative column counts spend since the baseline.

| Date | Activity | Usage before (USD) | Usage after (USD) | Delta (USD) | Cumulative (USD) |
|---|---|---|---|---|---|
| 2026-11-26 | T03/T04 baseline (status check only, before the first real chat call) | 0.0040 | 0.0040 | 0.0000 | 0.0000 |
| 2026-11-26 | T03 real chat smoke (1 request, `openai/gpt-6-luna`, one-word reply) | 0.0040 | 0.0040 | 0.0000 | 0.0000 |
| 2026-11-26 | T06 Luna Decisions recordings (2 real calls failed upstream 401 account_deactivated; 401-invalid-key and closed-port cases cost nothing) | 0.0040 | 0.0040 | 0.0000 | 0.0000 |
| 2026-11-26 | G1 gate (7 real chat turns, `openai/gpt-6-luna`: 6 prod + 1 dev; drift check crashed before any call) | 0.0040 | 0.0040 | 0.0000 | 0.0000 |
