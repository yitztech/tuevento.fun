import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { cn } from "@/lib/cn";

/** Aviso del formulario: error (role=alert) o confirmación (role=status). */
export function FormNotice({ tone, children }: { tone: "error" | "success" | "info"; children: React.ReactNode }) {
  const Icon = tone === "error" ? CircleAlert : tone === "info" ? Info : CircleCheck;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-sm",
        tone === "error" && "border-destructive/30 bg-destructive-soft text-destructive",
        tone === "success" && "border-success/30 bg-success-soft text-success-foreground",
        tone === "info" && "border-border bg-muted/60 text-muted-foreground",
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
