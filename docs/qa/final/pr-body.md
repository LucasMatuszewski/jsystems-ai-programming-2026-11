## Hardware Service Decision Copilot: PoC implementation

Next.js 16 app (`app/`) where a customer files a return (Zwrot) or complaint (Reklamacja) with a photo; an AI pipeline gives a preliminary recommendation (Akceptacja / Odrzucenie / Weryfikacja ręczna) with rule IDs, and a case chat lets the customer add facts. OpenRouter only, no data stored server-side.

### Scope by phase
- **Phase 0, docs and harness:** PRD, ADR-000..006, design guidelines, implementation plan, issue tracker, agent rules.
- **Phase 1, foundation:** scaffold, env and OpenRouter provider, chat streaming from `openai/gpt-6-luna`, recorded real responses (ADR-006), gate G1.
- **Phase 2, form to first decision:** form with validation, image handling, `/api/cases` (NDJSON), signals + escalation/writer pipeline, policy rules, chat page with summary panel, gate G2.
- **Phase 3, chat:** case chat route, `update_recommendation` tool and update card, new-case dialog, session restore, decision eval script, gates G3 and G3-D1.
- **Phase 4, hardening:** full E2E suites (desktop, failure, mobile), gate G4, independent review T28, fixes F1-F8 and G4 additions (T29), demo video (T30).

### Tests
- Unit/integration/component (Vitest): 54 files, 661 tests.
- E2E desktop + failure projects: 29 tests. E2E mobile (360 px): 27 tests. Real stack incl. OpenRouter.

### Acceptance criteria coverage
- Automated: see `app/tests/e2e/COVERAGE.md` (per-AC table).
- Manual: gate reports G2, G3 (+G3-D1) and G4 re-verify the rows marked "Manual only".
- Gaps: **AC-07** camera capture (only meaningful on a real phone, not exercised); **AC-28** (accept of complaint names remedy) never exercised in a real case, the E2E check is conditional on an Akceptacja decision; AC-35 update card appeared in G3/G4 manual runs but did not appear in the two T30 demo chat turns (model kept the recommendation).

### Reports
- Gates: [G1](docs/qa/G1/report.md), [G2](docs/qa/G2/report.md), [G3](docs/qa/G3/report.md), [G3-D1](docs/qa/G3-D1/report.md), [G4](docs/qa/G4/report.md), [G4b post-fix gate](docs/qa/G4b/report.md) (G4b-1 fix evidence: `docs/qa/G4b-1/`), G5 real-run closure gate: in progress
- Independent review: [T28 review](docs/qa/T28/review.md)
- Fixes and manual check: [T29 report](docs/qa/T29/report.md)

### Evidence
- Video (committed file, drag it into the description for inline playback): `docs/qa/final/demo.mp4`, chapters in `docs/qa/final/chapters.md`
- ![Return decision](docs/qa/final/return-decision.png)
- ![Complaint decision](docs/qa/final/complaint-decision.png)
- ![Mobile chat](docs/qa/final/mobile-chat.png)

### Verification limits and follow-ups
- Plan Rev. 6: AC-28 and the fast path were not reproducible in real runs with the current models (covered by tests on recordings); AC-07 needs a physical phone.
- Follow-ups FU-1 (decision-model calibration), FU-2 (GitHub Issues alignment), FU-3 (test-suite review) are in plan §11.
- Refs epic #10 (issues #11-#43 are not auto-closed by this PR because the base is the docs branch).

### OpenRouter spend
Total 0.1138 USD of the 5 USD cap (see `docs/qa/spend.md`).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
