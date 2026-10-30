import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { FormField } from "@/components/forms/FormField";
import { FormNotice } from "@/components/forms/FormNotice";
import { PasswordField } from "@/components/forms/PasswordField";
import { SocialAuthButtons } from "@/components/forms/SocialAuthButton";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { simulateRegister } from "@/features/auth/mockAuth";
import { limits, type RegisterValues, registerSchema } from "@/features/auth/schemas";
import { copy } from "@/lib/copy";

export function Register() {
  const [done, setDone] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema), mode: "onBlur", defaultValues: { name: "", email: "", password: "", terms: false, news: false } });

  const onSubmit = async () => {
    await simulateRegister();
    setDone(true);
  };

  return (
    <AuthShell photo="events/auth-registro" quote={copy.register.quote} benefits={copy.register.benefits}>
      <h1 className="font-serif text-[clamp(2rem,1.5rem+1.8vw,2.9rem)] leading-[1.05] font-semibold">{copy.register.title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{copy.register.text}</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-7 space-y-4" aria-busy={isSubmitting}>
        {done && <FormNotice tone="success">{copy.register.done}</FormNotice>}
        <FormField label={copy.register.name} error={errors.name?.message}>
          {(c) => <Input {...c} {...register("name")} autoComplete="name" maxLength={limits.name} placeholder={copy.register.namePlaceholder} />}
        </FormField>
        <FormField label={copy.auth.email} error={errors.email?.message}>
          {(c) => <Input {...c} {...register("email")} type="email" inputMode="email" autoComplete="email" maxLength={limits.email} placeholder={copy.auth.emailPlaceholder} />}
        </FormField>
        <PasswordField label={copy.auth.password} error={errors.password?.message} autoComplete="new-password" maxLength={limits.password} placeholder={copy.register.passwordPlaceholder} {...register("password")} />
        <div className="space-y-3 pt-1">
          <Controller
            control={control}
            name="terms"
            render={({ field }) => (
              <div>
                <div className="flex items-center gap-3">
                  <Checkbox id="terms" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} onBlur={field.onBlur} aria-invalid={Boolean(errors.terms)} aria-describedby={errors.terms ? "terms-error" : undefined} />
                  <Label htmlFor="terms" className="text-[0.82rem] leading-snug font-medium">
                    {copy.register.terms}{" "}
                    <a href="https://tuevento.fun/condiciones" className="font-bold text-primary underline underline-offset-4">
                      {copy.register.termsLink}
                    </a>
                  </Label>
                </div>
                {errors.terms && (
                  <p id="terms-error" role="alert" className="mt-1.5 text-xs font-semibold text-destructive">
                    {errors.terms.message}
                  </p>
                )}
              </div>
            )}
          />
          <Controller
            control={control}
            name="news"
            render={({ field }) => (
              <div className="flex items-center gap-3">
                <Checkbox id="news" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                <Label htmlFor="news" className="text-[0.82rem] leading-snug font-medium">
                  {copy.register.news}
                </Label>
              </div>
            )}
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? copy.register.submitting : copy.register.submit}
          <ArrowRight aria-hidden />
        </Button>
        <FormNotice tone="info">{copy.auth.prototype}</FormNotice>
      </form>
      <p className="my-5 flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">{copy.auth.orRegister}</p>
      <SocialAuthButtons />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {copy.register.haveAccount}{" "}
        <Link to="/login" className="font-bold text-primary underline underline-offset-4">
          {copy.register.login}
        </Link>
      </p>
    </AuthShell>
  );
}
