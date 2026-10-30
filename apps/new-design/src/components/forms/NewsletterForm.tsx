import { Mail } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { emailSchema } from "@/features/auth/schemas";
import { simulateNewsletter } from "@/features/auth/mockAuth";
import { copy } from "@/lib/copy";

type State = "idle" | "loading" | "done";

export function NewsletterForm() {
  const uid = useId();
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string>();
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = String(new FormData(e.currentTarget).get("email") ?? "");
    const parsed = emailSchema.safeParse({ email: value });
    if (!parsed.success) return setError(copy.newsletter.invalid);
    setError(undefined);
    setState("loading");
    await simulateNewsletter();
    setState("done");
  };
  if (state === "done") {
    return (
      <p role="status" className="rounded-lg bg-white/95 px-4 py-3 text-sm font-semibold text-title">
        {copy.newsletter.done} <span className="font-normal text-muted-foreground">{copy.newsletter.simulated}</span>
      </p>
    );
  }
  return (
    <form onSubmit={submit} noValidate className="w-full">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`${uid}-e`} className="sr-only">
          {copy.newsletter.label}
        </label>
        <input
          id={`${uid}-e`}
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          placeholder={copy.newsletter.placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${uid}-err` : undefined}
          className="min-h-12 min-w-0 flex-1 rounded-md border border-white/60 bg-white px-4 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-white/70 sm:text-sm"
        />
        <Button type="submit" size="lg" disabled={state === "loading"} className="bg-primary-hover hover:bg-[#6f281d]">
          <Mail aria-hidden />
          {state === "loading" ? copy.newsletter.sending : copy.newsletter.submit}
        </Button>
      </div>
      <p className="mt-2 text-xs text-white/85">{copy.newsletter.simulated}</p>
      {error && (
        <p id={`${uid}-err`} role="alert" className="mt-2 rounded bg-white/95 px-2 py-1 text-xs font-semibold text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
