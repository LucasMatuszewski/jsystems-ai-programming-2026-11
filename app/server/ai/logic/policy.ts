import "server-only"

import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import type { CaseType } from "@/lib/schemas"

export type LoadedPolicy = { text: string; ruleIds: string[]; version: string }

const POLICY_FILES: Record<CaseType, string> = {
  return: "return-policy.md",
  complaint: "complaint-policy.md",
}

const cache = new Map<string, LoadedPolicy>()

function extractRuleIds(text: string): string[] {
  const ruleIds = new Set<string>()
  let currentRuleId: string | null = null

  for (const line of text.split(/\r?\n/)) {
    const heading = /^\s{0,3}#{1,6}\s+([RC]-\d+(?:\.\d+)?)(?:\s|$)/.exec(line)
    if (heading?.[1]) {
      currentRuleId = heading[1]
      ruleIds.add(currentRuleId)
      continue
    }

    const numberedItem = /^\s{0,3}(\d+)\.\s+/.exec(line)
    if (currentRuleId && numberedItem?.[1]) {
      ruleIds.add(`${currentRuleId}.${numberedItem[1]}`)
    }
  }

  return [...ruleIds]
}

/** Loads and caches the case-type policy and its content-derived version. */
export function loadPolicy(caseType: CaseType, dir?: string): LoadedPolicy {
  const policyDir = path.resolve(/* turbopackIgnore: true */ dir ?? process.env.POLICIES_DIR ?? path.resolve(/* turbopackIgnore: true */ process.cwd(), "../docs/policies"))
  const filePath = path.join(/* turbopackIgnore: true */ policyDir, POLICY_FILES[caseType])
  const cached = cache.get(filePath)
  if (cached) return cached

  const text = readFileSync(/* turbopackIgnore: true */ filePath, "utf8")
  const ruleIds = extractRuleIds(text)
  if (ruleIds.length === 0) {
    throw new Error(`Policy contains no rule IDs: ${filePath}`)
  }

  const loaded: LoadedPolicy = {
    text,
    ruleIds,
    version: createHash("sha256").update(text).digest("hex").slice(0, 12),
  }
  cache.set(filePath, loaded)
  return loaded
}
