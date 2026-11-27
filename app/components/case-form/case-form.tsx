"use client"

import * as React from "react"
import { useForm, useWatch, type FieldErrors, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { addYears, todayInWarsaw } from "@/lib/dates"
import { pl } from "@/lib/i18n/pl"
import {
  CATEGORIES,
  CASE_TYPES,
  REASON_MAX,
  makeCaseFormFieldsSchema,
  type CaseFormFields,
  type CaseType,
  type Category,
} from "@/lib/schemas"
import { cn } from "@/lib/utils"
import { PhotoInput } from "./photo-input"
import { errorText } from "./messages"

export type CaseFormValues = CaseFormFields

type FormInputValues = {
  caseType: CaseType | ""
  category: Category | ""
  model: string
  purchaseDate: string
  reason: string
  consent: boolean
}

export type CaseFormProps = {
  onSubmit: (values: CaseFormValues, file: File) => void
  /** Submission in progress: disables the submit button. */
  disabled?: boolean
  /** Restores values after a failed submission (AC-41). */
  initialValues?: Partial<CaseFormValues>
  initialFile?: File | null
  /** Today as YYYY-MM-DD (Europe/Warsaw). Defaults to the current date. */
  today?: string
}

/** Fields in AC-01 order, used to focus the first invalid one (AC-12). */
const FIELD_ORDER = ["caseType", "category", "model", "purchaseDate", "reason", "photo", "consent"] as const

export function CaseForm({ onSubmit, disabled = false, initialValues, initialFile = null, today }: CaseFormProps) {
  const uid = React.useId()
  const ids = {
    caseType: `${uid}-case-type`,
    category: `${uid}-category`,
    model: `${uid}-model`,
    purchaseDate: `${uid}-purchase-date`,
    reason: `${uid}-reason`,
    photo: `${uid}-photo`,
    consent: `${uid}-consent`,
  }
  const effectiveToday = today ?? todayInWarsaw()
  const schema = React.useMemo(() => makeCaseFormFieldsSchema(effectiveToday), [effectiveToday])

  const form = useForm<FormInputValues, unknown, CaseFormValues>({
    resolver: zodResolver(schema) as unknown as Resolver<FormInputValues, unknown, CaseFormValues>,
    defaultValues: {
      caseType: initialValues?.caseType ?? "",
      category: initialValues?.category ?? "",
      model: initialValues?.model ?? "",
      purchaseDate: initialValues?.purchaseDate ?? "",
      reason: initialValues?.reason ?? "",
      consent: initialValues?.consent === true,
    },
  })
  const { register, control, formState } = form
  const errors = formState.errors as FieldErrors<FormInputValues>

  const [file, setFile] = React.useState<File | null>(initialFile)
  const [photoError, setPhotoError] = React.useState<string | null>(null)

  const caseType = useWatch({ control, name: "caseType" })
  const reasonLength = (useWatch({ control, name: "reason" }) ?? "").length
  const isComplaint = caseType === "complaint"
  const selectedType: CaseType | undefined = caseType === "" ? undefined : caseType

  const focusField = (name: (typeof FIELD_ORDER)[number]) => {
    if (name === "photo") {
      document.getElementById(ids.photo)?.focus()
      return
    }
    if (name === "caseType") {
      const first = document.querySelector<HTMLInputElement>(`input[name="caseType"]`)
      first?.focus()
      return
    }
    form.setFocus(name)
  }

  const handleValid = (values: CaseFormValues) => {
    if (!file) {
      setPhotoError((prev) => prev ?? "required")
      focusField("photo")
      return
    }
    onSubmit(values, file)
  }

  const handleInvalid = () => {
    if (!file) setPhotoError((prev) => prev ?? "required")
    const first = FIELD_ORDER.find((name) =>
      name === "photo" ? !file : Boolean(errors[name as keyof FormInputValues]),
    )
    if (first) focusField(first)
  }

  const errorFor = (name: keyof FormInputValues) => {
    const code = errors[name]?.message
    return typeof code === "string" && code ? code : null
  }

  const caseTypeError = errorFor("caseType")
  const categoryError = errorFor("category")
  const modelError = errorFor("model")
  const dateError = errorFor("purchaseDate")
  const reasonError = errorFor("reason")
  const consentError = errorFor("consent")
  const errorId = (name: string) => `${uid}-${name}-error`

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        if (disabled) {
          event.preventDefault()
          return
        }
        void form.handleSubmit(handleValid, handleInvalid)(event)
      }}
    >
      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={caseTypeError ? errorId("caseType") : undefined}
      >
        <legend className="mb-2 text-sm font-medium">{pl.labels.caseType}</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CASE_TYPES.map((type) => (
            <label
              key={type}
              className={cn(
                "relative flex cursor-pointer flex-col gap-1 rounded-2xl border bg-card p-4 transition-colors",
                // Hover: brand hard offset shadow plus a small lift (no movement with reduced motion).
                "hover:shadow-brand-md motion-safe:transition-[transform,box-shadow,color,background-color] motion-safe:hover:-translate-x-0.5 motion-safe:hover:-translate-y-0.5",
                "has-[:disabled]:cursor-not-allowed has-[:disabled]:shadow-none has-[:disabled]:translate-x-0 has-[:disabled]:translate-y-0",
                "has-[:checked]:border-ring has-[:checked]:ring-3 has-[:checked]:ring-ring/30",
                "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/30",
                caseTypeError ? "border-destructive" : "border-border",
              )}
            >
              <input
                type="radio"
                value={type}
                className="sr-only"
                disabled={disabled}
                {...register("caseType")}
              />
              <span className="text-base font-medium">{pl.caseTypes[type].label}</span>
              <span className="text-sm text-muted-foreground">{pl.caseTypes[type].subtitle}</span>
            </label>
          ))}
        </div>
        {caseTypeError ? (
          <p id={errorId("caseType")} role="alert" className="text-sm text-destructive">
            {errorText(caseTypeError)}
          </p>
        ) : null}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor={ids.category} className="text-sm font-medium">
          {pl.labels.category}
        </label>
        <select
          id={ids.category}
          disabled={disabled}
          aria-invalid={categoryError ? true : undefined}
          aria-describedby={categoryError ? errorId("category") : undefined}
          className={cn(
            "h-9 w-full rounded-2xl border bg-input/50 px-2.5 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm",
            categoryError ? "border-destructive" : "border-transparent",
          )}
          {...register("category")}
        >
          <option value="">{pl.labels.categoryPlaceholder}</option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {pl.categories[category]}
            </option>
          ))}
        </select>
        {categoryError ? (
          <p id={errorId("category")} role="alert" className="text-sm text-destructive">
            {errorText(categoryError)}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={ids.model} className="text-sm font-medium">
          {pl.labels.model}
        </label>
        <Input
          id={ids.model}
          type="text"
          autoComplete="off"
          placeholder={pl.placeholders.model}
          disabled={disabled}
          aria-invalid={modelError ? true : undefined}
          aria-describedby={modelError ? errorId("model") : undefined}
          {...register("model")}
        />
        {modelError ? (
          <p id={errorId("model")} role="alert" className="text-sm text-destructive">
            {errorText(modelError)}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={ids.purchaseDate} className="text-sm font-medium">
          {pl.labels.purchaseDate}
        </label>
        <Input
          id={ids.purchaseDate}
          type="date"
          min={addYears(effectiveToday, -5)}
          max={effectiveToday}
          disabled={disabled}
          aria-invalid={dateError ? true : undefined}
          aria-describedby={dateError ? errorId("purchaseDate") : undefined}
          {...register("purchaseDate")}
        />
        {dateError ? (
          <p id={errorId("purchaseDate")} role="alert" className="text-sm text-destructive">
            {errorText(dateError)}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={ids.reason} className="text-sm font-medium">
          {pl.labels.reason}
          {isComplaint ? (
            <span aria-hidden="true" className="ml-0.5 text-destructive">
              {pl.labels.requiredMarker}
            </span>
          ) : null}
        </label>
        <Textarea
          id={ids.reason}
          rows={4}
          placeholder={selectedType ? pl.placeholders.reason[selectedType] : undefined}
          aria-required={isComplaint ? true : undefined}
          disabled={disabled}
          aria-invalid={reasonError ? true : undefined}
          aria-describedby={reasonError ? errorId("reason") : undefined}
          {...register("reason")}
        />
        <div className="flex items-start justify-between gap-2">
          {reasonError ? (
            <p id={errorId("reason")} role="alert" className="text-sm text-destructive">
              {errorText(reasonError)}
            </p>
          ) : (
            <span />
          )}
          <span className="shrink-0 text-xs text-muted-foreground">
            {`${reasonLength}/${REASON_MAX}`}
          </span>
        </div>
      </div>

      <PhotoInput
        id={ids.photo}
        caseType={selectedType}
        file={file}
        error={photoError}
        disabled={disabled}
        onChange={(next, code) => {
          setFile(next)
          setPhotoError(code)
        }}
      />

      <label className="flex items-start gap-3 text-sm">
        <input
          id={ids.consent}
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 accent-primary"
          disabled={disabled}
          aria-invalid={consentError ? true : undefined}
          aria-describedby={consentError ? errorId("consent") : undefined}
          {...register("consent")}
        />
        <span>{pl.consent}</span>
      </label>
      {consentError ? (
        <p id={errorId("consent")} role="alert" className="-mt-4 text-sm text-destructive">
          {errorText(consentError)}
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={disabled}>
          {pl.form.submit}
        </Button>
      </div>
    </form>
  )
}
