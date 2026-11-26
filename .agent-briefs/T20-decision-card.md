# Brief T20 — DecisionCard and MessageParts (first message rendering)

Repo `/home/labuser/jsystems-ai-programming-2026-11`, app `app/`. Read `app/AGENTS.md`. Targeted tests: `pnpm exec vitest run <paths>`.

## Goal
- `app/components/chat/decision-card.tsx`: `DecisionCard({ kind: "initial" | "update", decision, ruleRefs, remedy?, previousDecision?, reason? })`. A badge with text plus icon per decision (Akceptacja ✓ `CheckCircle`, Odrzucenie ✕ `XCircle`, Weryfikacja ręczna ? `HelpCircle` from lucide-react), never distinguishable by colour alone. Colours come from semantic tokens: positive/negative/accent-warm. It shows the rule references, the remedy label (`pl.remedies`) when present, and for `update` the label `pl.updatedRecommendation` plus "previous → new" and the reason. The **fixed disclaimer `pl.disclaimer` sits inside the card, visually attached to the badge** (AC-29/30). `role="group"` with an `aria-label` that includes the decision.
- `app/components/chat/message-parts.tsx`: `MessageParts({ message: CaseUIMessage })` renders the parts in order:
  - `text`: Markdown via the template's `react-markdown` + `remark-gfm` (see `components/parts/text-part.tsx`; raw HTML is NOT enabled), so headings, bold and lists render (AC-31).
  - `data-decision`: `DecisionCard kind="initial"`.
  - `tool-update_recommendation`: with `output-available`, `DecisionCard kind="update"` from the output; with input-streaming/input-available, the text `pl.chat.updatingRecommendation`; with output-error, nothing.
  - `reasoning`, `reasoning-file`, `step-start`, unknown: render nothing (TAC-003-02).
- Brand styling via the Tailwind tokens in `app/app/globals.css` (3 px ink border, hard shadow, `rounded-card`; badge font Bangers via `font-display` for the decision word only). No raw hex.

Sources: PRD AC-21, AC-29–AC-31, AC-35, §9.3; ADR-003 §3.2 (MessageParts, DecisionCard), §8, TAC-003-01/02; design-guidelines "Components".

## Tests (first, red, then green) `app/tests/component/chat/first-message/*.test.tsx`
- Use `firstMessage` from the REAL recordings in `app/tests/fixtures/app/cases/*.ndjson.json` (parse the recorded NDJSON body, take the `result` event). Render it: greeting text → card → body, in DOM order; Markdown is rendered (a heading element exists, no `###` or `**` visible).
- TAC-003-01: for all 3 decisions × 2 kinds, the disclaimer text equals `pl.disclaimer` exactly. Build the variants from a recorded part (a derived variant that changes only `decision`/`kind`, and names its base).
- The update card shows previous → new and the label. Reasoning/unknown parts render nothing: use the recorded `app/tests/fixtures/openrouter/llm/chat-tool-update.json` `uiMessageChunks` to obtain real reasoning and tool parts, or a derived variant of the first message with a reasoning part appended (name the base).
- The icon and text exist for every decision.

## Editable files
`app/components/chat/decision-card.tsx`, `app/components/chat/message-parts.tsx`, `app/tests/component/chat/first-message/**`. Nothing else.

## Forbidden
No commits/`git add`, no dependency changes, never read `.env*`, no network.

## Report (≤ 20 lines)
Files · props · red→green counts · typecheck/lint.
