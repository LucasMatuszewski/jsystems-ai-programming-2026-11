import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-button border-[3px] border-hairline bg-clip-padding font-display text-xl tracking-[0.02em] whitespace-nowrap shadow-brand-md transition-all outline-none select-none focus-visible:outline-3 focus-visible:outline-accent-warm focus-visible:outline-offset-2 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline:
          "bg-surface-raised text-on-surface hover:bg-surface-raised/80 aria-expanded:bg-surface-raised aria-expanded:text-on-surface",
        secondary:
          "bg-surface-raised text-on-surface hover:bg-surface-raised/80 aria-expanded:bg-surface-raised aria-expanded:text-on-surface",
        ghost:
          "hover:bg-accent-warm hover:text-on-accent-warm aria-expanded:bg-accent-warm aria-expanded:text-on-accent-warm",
        destructive:
          "bg-negative text-primary-foreground hover:bg-negative/90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "min-h-11 gap-2 px-4 py-2 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "min-h-8 gap-1 px-2.5 py-1 text-sm has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "min-h-9 gap-1 px-3 py-1.5 text-base has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        lg: "min-h-12 gap-2 px-5 py-2.5 text-2xl has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-11",
        "icon-xs": "size-8 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-9",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
