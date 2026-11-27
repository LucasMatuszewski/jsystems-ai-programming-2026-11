import { loadFixture, type Fixture } from "./replay-fetch"

/**
 * DERIVED variant of a recorded decision/writer output (AC-23, G4): the recordings predate the
 * rule "the justification states the system day count", so this adds one bullet with the recorded
 * request's `days` as the first line of the "### Uzasadnienie" section. Everything else stays as recorded.
 */
export function withJustificationDays(fixturePath: string): Fixture {
  const fixture = loadFixture(fixturePath)
  const days = (fixture.meta.request as { days: number }).days
  const exchange = fixture.exchanges[0]!
  const body = JSON.parse(exchange.response!.body.trim()) as { choices: Array<{ message: { content: string } }> }
  const output = JSON.parse(body.choices[0]!.message.content) as { bodyMarkdown: string }
  output.bodyMarkdown = justificationWithDays(output.bodyMarkdown, days)
  body.choices[0]!.message.content = JSON.stringify(output)
  return { ...fixture, exchanges: [{ ...exchange, response: { ...exchange.response!, body: JSON.stringify(body) } }] }
}

export function justificationWithDays(bodyMarkdown: string, days: number): string {
  const marker = "### Uzasadnienie\n"
  if (!bodyMarkdown.includes(marker)) throw new Error("recording has no Uzasadnienie section")
  return bodyMarkdown.replace(marker, `${marker}- Od zakupu minęło ${days} dni.\n`)
}
