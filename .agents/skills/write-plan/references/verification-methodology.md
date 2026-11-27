# Verification methodology (automated + manual, every phase)

The plan must make workers and the orchestrator prove correctness **continuously**, not only at the end. Put these rules into the plan's "Delivery approach" and gate rows, and link to the project's ADR that records them (create a Proposed ADR if none exists).

## 1. Layers and when they run

| Layer | When | Doubles allowed | Evidence |
|---|---|---|---|
| Unit | Inside each task, written first (red → green) | Replays of recorded calls only (see §2); pure functions over internal types need none | Red run output + green run output in the worker report |
| Component | Inside each UI task | Replays of recorded own-endpoint responses | Same |
| Integration | Inside each integration task | Recorded external API replays only | Same + call counters |
| E2E | Specs early (expected-to-fail), green after wiring | **None** (real stack, real external APIs) | Runner output with discovered/passed/skipped counts |
| Task-level manual check | End of every task that changes what the running app does | None | Short note + screenshot or request log in the task report |
| Phase gate (G1…Gn) | End of every phase | None | `docs/qa/<gate>/report.md` + committed screenshots |
| Final regression + demo | Before the implementation PR | None | Gate report + demo video |

Report build, tests (discovered/passed/skipped) and startup as **separate** results. A green build or E2E run never replaces startup and manual use.

## 2. Test doubles come only from recorded real calls

- Every double of an endpoint — external APIs **and the application's own endpoints** — replays a recording made by a fresh real request in an authorized environment with synthetic data. No hand-written bodies, no scripted streams, no shapes copied from documentation.
- Each recording stores: date/time, target (URL or model ID), request summary (no secrets), app commit, package versions, provider-reported endpoint. A metadata scan test enforces it.
- **Derived variants** may change values of fields that exist in a named base recording (to hit a boundary). Structure, field set and chunk order stay identical; the variant names its base and the changed fields.
- **Errors:** record what can be produced safely for real (e.g. invalid key → 401; base URL to a closed local port → connection failure; server-side validation errors by sending a real invalid request). Errors you must not provoke (402, 429, 503, mid-stream failures) are listed in a `GAPS.md`, never invented.
- Record own endpoints with a small script that sends real HTTP requests to the running app — this works before the UI is wired. Manual browser sessions may additionally save exchanges.
- Refresh recordings when a prompt version, schema, model ID or package version they depend on changes. A `--compare` mode re-requests live and reports structural drift; run it at every gate.
- Code that runs external calls accepts injected dependencies (models, clock, sinks) so tests can pass replay doubles and recording scripts can pass error-producing configurations.

## 3. Call accounting and limits

- One log line per outbound external call (request ID, stage, model/endpoint, status, latency, cost if reported; no user content) and one per incoming request with the same request ID.
- The plan contains an **expected call budget** per user action (page load, refresh, validation error, submit, chat turn, retry…). Measured counts at every gate must match; extra or duplicate calls are defects. Check once in development mode too (e.g. React Strict Mode double effects).
- A limits/status command prints remaining credit and rate limits for the provider key (never the key) and model availability. Gates start only when limits allow; usage before/after is logged in `docs/qa/spend.md`. Stop and ask when the agreed spend cap is near (e.g. at 90%).
- The application has no mock/demo mode and no flag that swaps a real model for a fake one; test doubles live only under `tests/`. Gates never disable models or features to save cost.

## 4. Manual gates are interactive, not scripted

- Start the real app with its verified command and real configuration.
- Drive it one command at a time with a browser CLI (e.g. `playwright-cli open` → `snapshot` → decide → `fill`/`select`/`upload`/`click`/`type`/`press` → `snapshot`/`screenshot`). Forbidden in gates: pre-written command sequences, code-execution commands (`run-code`, `eval`), replayed recordings, network mocking (`route`), or running the E2E suite as a substitute.
- Chat/conversational features: each next message is written from the previous answer (real-time conversation). Cover a clarifying question, a policy/domain question, a new relevant fact, insistence without new facts, off-topic, and an instruction-injection attempt.
- Desktop applications use their real UI; CLIs use observable commands; APIs use real requests.
- Check console errors, language of UI text, accessibility basics, and compare screenshots with the project's visual reference at desktop and mobile widths.
- Defects become fix tasks in the same phase; the gate is repeated until it passes. The next phase starts only after its gate passes.

## 5. Evidence and final documentation

- Screenshots are committed under `docs/qa/<gate>/` so the user can review them.
- Final demo video: record the interactive walkthrough with the browser CLI's video commands (chapters, action callouts), convert/compress with ffmpeg (H.264 MP4, ≤ 10 MB) into `docs/qa/final/`. If ffmpeg is missing and root is not available, use a user-level static build (e.g. `pip install --user imageio-ffmpeg`, binary from `imageio_ffmpeg.get_ffmpeg_exe()`). `gh` cannot upload inline PR videos: link the committed file and tell the user they can drag it into the PR description.
