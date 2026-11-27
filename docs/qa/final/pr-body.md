## Hardware Service Decision Copilot: PoC implementation

Next.js 16 app (`app/`) where a customer files a return (Zwrot) or complaint (Reklamacja) with a photo; an AI pipeline gives a preliminary recommendation (Akceptacja / Odrzucenie / Weryfikacja ręczna) with rule IDs, and a case chat lets the customer add facts. OpenRouter only, no data stored server-side.

### Scope by phase
- **Phase 0, docs and harness:** PRD, ADR-000..006, design guidelines, implementation plan, issue tracker, agent rules.
- **Phase 1, foundation:** scaffold, env and OpenRouter provider, chat streaming from `openai/gpt-6-luna`, recorded real responses (ADR-006), gate G1.
- **Phase 2, form to first decision:** form with validation, image handling, `/api/cases` (NDJSON), signals + escalation/writer pipeline, policy rules, chat page with summary panel, gate G2.
- **Phase 3, chat:** case chat route, `update_recommendation` tool and update card, new-case dialog, session restore, decision eval script, gates G3 and G3-D1.
- **Phase 4, hardening:** full E2E suites (desktop, failure, mobile), gate G4, independent review T28, fixes F1-F8 and G4 additions (T29), demo video (T30).

### Tests
- Unit/integration/component (Vitest): 54 files, 671 tests.
- E2E desktop + failure projects: 29 tests. E2E mobile (360 px): 27 tests. Real stack incl. OpenRouter.

### Acceptance criteria coverage
- Automated: see `app/tests/e2e/COVERAGE.md` (per-AC table).
- Manual: gate reports G2, G3 (+G3-D1) and G4 re-verify the rows marked "Manual only".
- Gaps: **AC-07** native camera picker (needs a physical phone; everything else verified by emulation); the fast path opens in a real run only at the verification threshold 0.3 (G5c); at the production 0.8 it never opened (FU-1). AC-28 is verified live (G5-1, G5b).

### Reports
- Gates: [G1](docs/qa/G1/report.md), [G2](docs/qa/G2/report.md), [G3](docs/qa/G3/report.md), [G3-D1](docs/qa/G3-D1/report.md), [G4](docs/qa/G4/report.md), [G4b post-fix gate](docs/qa/G4b/report.md) (G4b-1 fix evidence: `docs/qa/G4b-1/`), [G5 real-run closure](docs/qa/G5/report.md), [G5-1 fix](docs/qa/G5-1/notes.md), [G5b re-check](docs/qa/G5b/notes.md), [G5c fast path](docs/qa/G5c/notes.md)
- Independent review: [T28 review](docs/qa/T28/review.md)
- Fixes and manual check: [T29 report](docs/qa/T29/report.md)

### Demo
Condensed walkthrough, 2:25 (static waits cut automatically, motion kept at 1×): [demo-condensed.mp4](https://github.com/LucasMatuszewski/jsystems-ai-programming-2026-11/blob/feat/app-implementation/docs/qa/final/demo-condensed.mp4). The full 8:08 recording is `docs/qa/final/demo.mp4`. Drag the file into this description for inline playback.

| Time | Chapter |
|---|---|
| 0:00 | Empty form |
| 0:06 | Return: laptop, 10 days |
| 0:35 | Chat: new fact |
| 1:10 | Refresh |
| 1:16 | Nowe zgłoszenie |
| 1:39 | Complaint: smartphone, 400 days |
| 2:15 | Mobile 360 px |

### Screenshots
| Return decision | Complaint decision |
|---|---|
| ![Return decision](https://github.com/LucasMatuszewski/jsystems-ai-programming-2026-11/raw/feat/app-implementation/docs/qa/final/return-decision.png) | ![Complaint decision](https://github.com/LucasMatuszewski/jsystems-ai-programming-2026-11/raw/feat/app-implementation/docs/qa/final/complaint-decision.png) |

| Validation errors (empty submit) | Invalid values |
|---|---|
| ![Empty submit](https://github.com/LucasMatuszewski/jsystems-ai-programming-2026-11/raw/feat/app-implementation/docs/qa/G4/d-form-errors-empty.png) | ![Invalid values](https://github.com/LucasMatuszewski/jsystems-ai-programming-2026-11/raw/feat/app-implementation/docs/qa/G4/d-form-errors-invalid.png) |

| Analysis failure banner (invalid key) | Mobile chat |
|---|---|
| ![Failure banner](https://github.com/LucasMatuszewski/jsystems-ai-programming-2026-11/raw/feat/app-implementation/docs/qa/G2/failure-banner.png) | ![Mobile chat](https://github.com/LucasMatuszewski/jsystems-ai-programming-2026-11/raw/feat/app-implementation/docs/qa/final/mobile-chat.png) |

### Verification limits and follow-ups
- AC-28 (remedy for an accepted complaint) is verified live on both the first decision and a chat update card (plan Rev. 7).
- Fast path observed in a real run at the verification threshold 0.3 ([G5c](docs/qa/G5c/notes.md): signals → writer, Akceptacja); at the production 0.8 it never opened, so calibration is FU-1. AC-07's native camera picker needs a physical phone.
- Follow-ups FU-1 (decision-model calibration), FU-2 (GitHub Issues alignment), FU-3 (test-suite review) are in plan §11.
- Refs epic #10 (issues #11-#43 are not auto-closed by this PR because the base is the docs branch).

### OpenRouter spend
Total 0.1138 USD of the 5 USD cap (see `docs/qa/spend.md`).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
