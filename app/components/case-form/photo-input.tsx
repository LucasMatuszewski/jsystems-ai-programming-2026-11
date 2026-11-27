"use client"

import * as React from "react"
import { UploadIcon } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { pl } from "@/lib/i18n/pl"
import type { CaseType } from "@/lib/schemas"
import { PHOTO_ACCEPT, validatePhotoFile } from "./photo-checks"
import { errorText } from "./messages"

export type PhotoInputProps = {
  id: string
  caseType?: CaseType
  file: File | null
  /** Error code (see `pl.errors`) shown under the field. */
  error?: string | null
  disabled?: boolean
  /** Called with the accepted file, or `null` plus the error code when a file is rejected. */
  onChange: (file: File | null, errorCode: string | null) => void
}

export function PhotoInput({ id, caseType, file, error, disabled, onChange }: PhotoInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = React.useState(false)
  const previewRef = React.useRef<HTMLImageElement>(null)

  // Object URL for the thumbnail, set on the <img> directly; revoked when the file changes or on unmount.
  React.useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    if (previewRef.current) previewRef.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  const hintId = `${id}-hint`
  const noteId = `${id}-note`
  const errorId = `${id}-error`
  const describedBy = [caseType ? hintId : null, noteId, error ? errorId : null]
    .filter(Boolean)
    .join(" ")

  const openPicker = () => {
    if (!disabled) inputRef.current?.click()
  }

  async function handleFiles(files: FileList | null) {
    const picked = files?.[0]
    if (!picked) return
    const result = await validatePhotoFile(picked)
    if (result.ok) onChange(picked, null)
    else onChange(null, result.code)
  }

  // aria-invalid marks this field's error state on the drop-zone button; jsx-a11y does not allow it on role=button.
  /* eslint-disable jsx-a11y/role-supports-aria-props */
  return (
    <div
      className={cn(
        "relative flex flex-col gap-2 rounded-2xl border border-dashed bg-card p-3 transition-colors",
        "hover:border-ring hover:bg-accent-warm/10",
        dragging ? "border-solid border-ring bg-accent-warm/25" : "border-border",
      )}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        if (!disabled) void handleFiles(event.dataTransfer.files)
      }}
    >
      <label htmlFor={id} className="text-sm font-medium">
        {pl.labels.photo}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={openPicker}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={cn(
            file
              ? "flex min-h-16 flex-1 items-center gap-3 rounded-2xl bg-transparent px-3 py-2 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
              : cn(buttonVariants({ variant: "outline", size: "lg" }), "cursor-pointer hover:bg-accent-warm hover:text-on-accent-warm"),
          )}
        >
          {file ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- object URL preview */}
              <img ref={previewRef} alt="" className="size-14 rounded-xl object-cover" />
              <span className="truncate">{file.name}</span>
            </>
          ) : (
            <>
              <UploadIcon aria-hidden="true" />
              <span>{pl.photo.add}</span>
            </>
          )}
        </button>
        {file ? null : (
          <span className="text-sm text-muted-foreground">{pl.photo.dropHint}</span>
        )}
        {file ? (
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={openPicker}>
            {pl.changePhoto}
          </Button>
        ) : null}
      </div>
      {caseType ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {pl.photoHints[caseType]}
        </p>
      ) : null}
      <p id={noteId} className="text-sm text-muted-foreground">
        {pl.personalDataNote}
      </p>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {errorText(error)}
        </p>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={PHOTO_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        onChange={(event) => {
          void handleFiles(event.target.files)
          event.target.value = ""
        }}
      />
    </div>
  )
  /* eslint-enable jsx-a11y/role-supports-aria-props */
}
