import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, MailCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { FormField } from "@/components/forms/FormField";
import { FormNotice } from "@/components/forms/FormNotice";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { simulateRecover } from "@/features/auth/mockAuth";
import { type EmailValues, emailSchema, limits } from "@/features/auth/schemas";
import { copy } from "@/lib/copy";

export function ForgotPassword() {
  const [sentTo, setSentTo] = useState<string>();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EmailValues>({ resolver: zodResolver(emailSchema), mode: "onBlur" });

  const onSubmit = async (v: EmailValues) => {
    await simulateRecover();
    setSentTo(v.email);
  };

  return (
    <AuthShell photo="events/auth-recuperar" quote={copy.recover.quote} help={{ title: copy.recover.helpTitle, items: copy.recover.help }}>
      <h1 className="font-serif text-[clamp(2rem,1.5rem+1.8vw,2.9rem)] leading-[1.05] font-semibold">{copy.recover.title}</h1>
      {sentTo ? (
        <div className="mt-7 space-y-5" role="status">
          <MailCheck aria-hidden className="size-10 text-primary" />
          <h2 className="font-sans text-lg font-bold text-title">{copy.recover.doneTitle}</h2>
          <p className="text-sm text-muted-foreground">{copy.recover.done(sentTo)}</p>
          <FormNotice tone="info">{copy.auth.prototype}</FormNotice>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              setSentTo(undefined);
            }}
          >
            {copy.recover.retry}
          </Button>
        </div>
      ) : (
        <>
          <p className="mt-3 text-sm text-muted-foreground">{copy.recover.text}</p>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-7 space-y-4" aria-busy={isSubmitting}>
            <FormField label={copy.auth.email} error={errors.email?.message}>
              {(c) => <Input {...c} {...register("email")} type="email" inputMode="email" autoComplete="email" maxLength={limits.email} placeholder={copy.auth.emailPlaceholder} />}
            </FormField>
            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? copy.recover.submitting : copy.recover.submit}
              <ArrowRight aria-hidden />
            </Button>
          </form>
        </>
      )}
      <p className="mt-6">
        <Link to="/login" className="text-sm font-bold text-primary underline underline-offset-4">
          {copy.recover.back}
        </Link>
      </p>
    </AuthShell>
  );
}
