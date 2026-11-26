import "server-only"

import fs from "node:fs"
import path from "node:path"

export const PROMPT_NAMES = [
  "decision-return",
  "decision-complaint",
  "writer",
  "chat-return",
  "chat-complaint",
] as const

export type PromptName = (typeof PROMPT_NAMES)[number]

export type LoadedPrompt = { name: PromptName; version: string; text: string }

const SHARED_PLACEHOLDER = "{{shared_rules}}"
const cache = new Map<string, LoadedPrompt>()

function readRaw(file: string): { version: string; body: string } {
  const full = path.join(process.cwd(), "server/ai/prompts", `${file}.md`)
  const raw = fs.readFileSync(full, "utf8").replace(/\r\n/g, "\n")
  const match = /^---\nversion: (\S+)\n---\n/.exec(raw)
  if (!match?.[1]) throw new Error(`Prompt ${file} has no version front matter`)
  if (!new RegExp(`^${file}@\\d+\\.\\d+\\.\\d+$`).test(match[1]))
    throw new Error(`Prompt ${file} has an invalid version: ${match[1]}`)
  return { version: match[1], body: raw.slice(match[0].length).trim() }
}

export function loadPrompt(name: PromptName): LoadedPrompt {
  const hit = cache.get(name)
  if (hit) return hit
  const { version, body } = readRaw(name)
  const shared = readRaw("shared-rules").body
  const prompt: LoadedPrompt = {
    name,
    version,
    text: body.split(SHARED_PLACEHOLDER).join(shared),
  }
  cache.set(name, prompt)
  return prompt
}
