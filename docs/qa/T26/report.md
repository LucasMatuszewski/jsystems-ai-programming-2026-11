# T26 decision evaluation (2026-11-26, run 15:04 UTC, exit 0)

Command: `timeout 15m pnpm eval:decisions`. Log: `docs/qa/T26/run.log`. JSON: `docs/qa/T26/eval-2026-11-26T15-04-06-983Z.json`.
Upstream calls: 20 (10 signals, 10 escalated, 0 writer). Limit 30 kept. Config: threshold 0.8, fast path forced on for the gate.

| Case | Gate | Escalated |
|---|---|---|
| return x 5 photos | 0 of 5 eligible | Akceptacja 2, Weryfikacja ręczna 3 |
| complaint x 5 photos | 0 of 5 eligible | Odrzucenie 2, Weryfikacja ręczna 3 |

- Agreement: 0/0 compared. No case passed the gate, so no fast-path decision was produced.
- Threshold observation: the gate failed on confidence below 0.8 for most answers (for example condition 0.21 to 0.77, damage_visible 0.67 to 0.70 on phone-2, description_consistent 0.50 to 0.60). Two return cases escalated to Akceptacja (phone-2 at 0.21 min, phone-3 at 0.77) with the gate closed; the per-case minimum is in the run table.
- No threshold suggestion can be derived from this run. Do not change 0.8 on this evidence.
- Cost: upstream lines 20, `usage.cost` 0 under BYOK. Key usage unchanged: USD 0.1115 before and after (`status-before.log`, `status-after.log`). Cumulative spend stays USD 0.1115 of the USD 5 cap.
- Known defect: escalated and writer latency are logged as 0 on success (only the signals latency is measured). Fix before the next run; the JSON `runs[].escalated.call.latencyMs` is unreliable.
- Jev 1.14 signals returned `status ok` for all 10 cases.
