"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { formatPlDate } from "@/lib/dates"
import { pl } from "@/lib/i18n/pl"
import type { CaseSessionPayload } from "@/lib/schemas/session"
import type { Decision } from "@/lib/schemas/enums"
import { DecisionBadge } from "./decision-badge"
import { NewCaseDialog } from "./new-case-dialog"

export type CurrentDecision = { decision: Decision; ruleRefs: string[] }

export type CaseSummaryPanelProps = {
  payload: CaseSessionPayload
  currentDecision: CurrentDecision
  onNewCase: () => void
  /** desktop: static column (PRD 9.3). mobile: collapsible, collapsed by default. */
  variant?: "desktop" | "mobile"
}

export function CaseSummaryPanel({
  payload,
  currentDecision,
  onNewCase,
  variant = "desktop",
}: CaseSummaryPanelProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const body = (
    <CaseSummaryBody
      payload={payload}
      currentDecision={currentDecision}
      onRequestNewCase={() => setConfirmOpen(true)}
    />
  )
  const confirm = (
    <NewCaseDialog open={confirmOpen} onOpenChange={setConfirmOpen} onConfirm={onNewCase} />
  )

  if (variant === "mobile") {
    return (
      <Collapsible data-slot="case-summary-panel" data-variant="mobile" className="rounded-card border-[3px] border-hairline bg-card text-card-foreground shadow-brand-md">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-4 text-left outline-none focus-visible:outline-3 focus-visible:outline-accent-warm focus-visible:outline-offset-2">
          <span className="font-heading text-xl tracking-[0.02em]">{pl.caseTypes[payload.form.caseType].label}</span>
          <DecisionBadge decision={currentDecision.decision} />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pb-4">{body}</CollapsibleContent>
        {confirm}
      </Collapsible>
    )
  }

  return (
    <aside
      data-slot="case-summary-panel"
      data-variant="desktop"
      aria-label={pl.summary.currentDecision}
      className="rounded-card border-[3px] border-hairline bg-card p-5 text-card-foreground shadow-brand-lg"
    >
      {body}
      {confirm}
    </aside>
  )
}

function CaseSummaryBody({
  payload,
  currentDecision,
  onRequestNewCase,
}: {
  payload: CaseSessionPayload
  currentDecision: CurrentDecision
  onRequestNewCase: () => void
}) {
  const { form } = payload
  const [photoOpen, setPhotoOpen] = useState(false)

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-3 text-sm">
        <Field term={pl.summary.caseType} value={pl.caseTypes[form.caseType].label} />
        <Field term={pl.summary.category} value={pl.categories[form.category]} />
        <Field term={pl.summary.model} value={form.model} />
        <Field term={pl.summary.purchaseDate} value={formatPlDate(form.purchaseDate)} />
        <Field term={pl.summary.daysSincePurchase} value={String(payload.daysSincePurchase)} />
      </dl>

      <button
        type="button"
        onClick={() => setPhotoOpen(true)}
        className="block w-full overflow-hidden rounded-button border-[3px] border-hairline bg-surface-raised shadow-brand-sm outline-none focus-visible:outline-3 focus-visible:outline-accent-warm focus-visible:outline-offset-2"
      >
        {/* Data URL thumbnail from the API; next/image does not optimise data URLs. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={payload.thumbnailDataUrl} alt={pl.summary.photo} className="aspect-4/3 w-full object-contain" />
      </button>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold text-muted-foreground">{pl.summary.currentDecision}</span>
        <DecisionBadge decision={currentDecision.decision} />
      </div>

      <Button variant="outline" onClick={onRequestNewCase} className="w-full">
        {pl.newCase.button}
      </Button>

      <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
        <DialogContent className="max-w-2xl">
          <DialogTitle className="sr-only">{pl.summary.photo}</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={payload.thumbnailDataUrl} alt={pl.summary.photo} className="max-h-[70vh] w-full object-contain" />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Field({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs font-bold text-muted-foreground">{term}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  )
}
