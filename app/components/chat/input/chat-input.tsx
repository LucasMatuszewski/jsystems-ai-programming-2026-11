"use client"

import { useState, type KeyboardEvent } from "react"
import { SendHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { pl } from "@/lib/i18n/pl"
import { CHAT_MESSAGE_MAX } from "@/lib/schemas/session"

type ChatInputProps = {
  /** True while a reply is being produced (AC-33). */
  disabled: boolean
  onSend: (text: string) => void
}

/** Message box: Enter sends, Shift+Enter adds a line, 1-2000 characters (AC-32). */
export function ChatInput({ disabled, onSend }: ChatInputProps) {
  const [value, setValue] = useState("")
  const trimmed = value.trim()
  const tooLong = trimmed.length > CHAT_MESSAGE_MAX
  const canSend = !disabled && trimmed.length > 0 && !tooLong

  const submit = () => {
    if (!canSend) return
    onSend(trimmed)
    setValue("")
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <div className="flex items-end gap-2">
        <Textarea
          aria-label={pl.chat.inputLabel}
          aria-invalid={tooLong || undefined}
          aria-describedby={tooLong ? "chat-input-error" : undefined}
          placeholder={pl.chat.inputPlaceholder}
          value={value}
          disabled={disabled}
          rows={1}
          className="max-h-40 min-h-11"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <Button type="submit" disabled={!canSend} className="shrink-0">
          <SendHorizontal aria-hidden="true" />
          {pl.chat.send}
        </Button>
      </div>
      {tooLong ? (
        <p id="chat-input-error" className="text-sm text-negative">
          {pl.chat.tooLong}
        </p>
      ) : null}
    </form>
  )
}
