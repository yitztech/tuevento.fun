import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Variantes de DESIGN.md: default = principal (terracota), outline = secundario,
// celebrate = ámbar, destructive y destructive-outline = acciones que borran,
// ghost + size icon = botón de icono, link + size inline = acción de texto.
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2.5 rounded-md border border-transparent text-[13px] leading-[1.3] font-bold whitespace-nowrap transition-[background-color,color,transform] duration-200 ease-out outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-55 aria-invalid:border-destructive aria-invalid:ring-destructive/20 motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:-translate-y-px hover:bg-primary-hover motion-reduce:hover:translate-y-0",
        outline:
          "border-input bg-background text-foreground hover:-translate-y-px hover:bg-secondary motion-reduce:hover:translate-y-0",
        celebrate:
          "bg-celebrate text-celebrate-foreground hover:-translate-y-px hover:bg-celebrate-hover motion-reduce:hover:translate-y-0",
        destructive:
          "bg-destructive text-destructive-foreground hover:-translate-y-px hover:bg-destructive-hover motion-reduce:hover:translate-y-0 focus-visible:ring-destructive/20",
        "destructive-outline":
          "border-destructive/20 bg-background text-destructive hover:-translate-y-px hover:border-destructive/45 hover:bg-destructive-soft hover:text-destructive-hover motion-reduce:hover:translate-y-0 focus-visible:ring-destructive/20",
        ghost: "hover:bg-accent",
        link: "text-xs font-[750] text-primary underline-offset-[5px] hover:underline",
      },
      size: {
        default: "min-h-11 px-5 py-3",
        sm: "min-h-9 gap-2 px-3.5 py-2",
        icon: "size-9 rounded-sm",
        inline: "gap-2 px-0 py-2",
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
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
