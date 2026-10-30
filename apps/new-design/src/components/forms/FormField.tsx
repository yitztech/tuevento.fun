import { useId } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

type ControlProps = { id: string; "aria-invalid": boolean; "aria-describedby": string | undefined };

type Props = {
  label: string;
  error?: string;
  hint?: string;
  /** Contenido a la derecha de la etiqueta (p. ej. «¿Olvidaste tu contraseña?») */
  action?: React.ReactNode;
  className?: string;
  children: (control: ControlProps) => React.ReactNode;
};

/** Etiqueta, control, ayuda y error enlazados con `for`, `aria-invalid` y `aria-describedby`. */
export function FormField({ label, error, hint, action, className, children }: Props) {
  const uid = useId();
  const id = `${uid}-field`;
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {action}
      </div>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
