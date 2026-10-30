import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "min-h-11 w-full min-w-0 rounded-sm border border-input bg-background px-3 py-3 text-xs leading-normal text-foreground transition-[color,box-shadow] outline-none selection:bg-celebrate selection:text-primary file:inline-flex file:border-0 file:bg-transparent file:text-xs file:font-bold file:text-foreground placeholder:text-muted-foreground read-only:bg-muted read-only:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 max-[480px]:min-h-[46px] max-[480px]:p-[11px] max-[480px]:text-sm",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
