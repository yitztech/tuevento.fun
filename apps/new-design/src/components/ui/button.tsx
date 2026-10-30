import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/cn";

export const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-transparent text-sm font-bold whitespace-nowrap transition-[background-color,color,box-shadow,transform] duration-200 outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-soft hover:bg-primary-hover",
        outline: "border-input bg-card text-title hover:bg-accent-soft",
        soft: "bg-accent-soft text-primary hover:bg-accent/60",
        ghost: "text-title hover:bg-accent-soft",
        link: "min-h-0 px-0 py-1 text-primary underline underline-offset-4 hover:text-primary-hover",
        light: "bg-card text-primary hover:bg-accent-soft",
      },
      size: {
        default: "min-h-11 px-5 py-2.5",
        lg: "min-h-12 px-6 py-3 text-[0.95rem]",
        sm: "min-h-9 px-3.5 py-2 text-[0.8rem]",
        icon: "size-11 rounded-full",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type = "button",
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" type={asChild ? undefined : type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
