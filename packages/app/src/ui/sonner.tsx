import type * as React from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

// Aviso de DESIGN.md: fondo principal, texto blanco, abajo al centro. Sin modo oscuro (la web no
// lo tiene). Las etiquetas accesibles (containerAriaLabel, closeButtonAriaLabel) las pone quien
// lo usa, traducidas.
const Toaster = ({ toastOptions, ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="bottom-center"
      className="toaster group"
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast:
            "gap-3! rounded-[10px]! border-0! py-3! pr-3! pl-[22px]! text-xs! shadow-[0_6px_25px_#16213a29]!",
          closeButton:
            "static! order-last! ml-auto! size-[27px]! transform-none! rounded-sm! border-0! bg-transparent! text-primary-foreground! hover:bg-primary-hover!",
        },
      }}
      style={
        {
          "--normal-bg": "var(--primary)",
          "--normal-text": "var(--primary-text)",
          "--normal-border": "var(--primary)",
          "--border-radius": "10px",
          "--offset-bottom": "27px",
          "--mobile-offset-bottom": "16px",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
