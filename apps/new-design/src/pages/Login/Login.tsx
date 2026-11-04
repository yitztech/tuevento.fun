import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { FormField } from "@/components/forms/FormField";
import { FormNotice } from "@/components/forms/FormNotice";
import { PasswordField } from "@/components/forms/PasswordField";
import { SocialAuthButtons } from "@/components/forms/SocialAuthButton";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { simulateLogin } from "@/features/auth/mockAuth";
import { type LoginValues, limits, loginSchema } from "@/features/auth/schemas";
import { copy } from "@/lib/copy";

export function Login() {
  const [failed, setFailed] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), mode: "onBlur" });

  const onSubmit = async () => {
    setFailed(false);
    const r = await simulateLogin();
    if (!r.ok) setFailed(true);
  };

  return (
    <AuthShell photo="events/auth-login" quote={copy.login.quote} benefits={copy.login.benefits}>
      <h1 className="font-serif text-[clamp(2rem,1.5rem+1.8vw,2.9rem)] leading-[1.05] font-semibold">{copy.login.title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{copy.login.text}</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-7 space-y-4" aria-busy={isSubmitting}>
        {failed && <FormNotice tone="error">{copy.login.failed}</FormNotice>}
        <FormField label={copy.auth.email} error={errors.email?.message}>
          {(c) => <Input {...c} {...register("email")} type="email" inputMode="email" autoComplete="username" maxLength={limits.email} placeholder={copy.auth.emailPlaceholder} />}
        </FormField>
        <PasswordField
          label={copy.auth.password}
          error={errors.password?.message}
          autoComplete="current-password"
          maxLength={limits.password}
          action={
            <Link to="/recuperar-contrasena" className="text-xs font-semibold text-primary underline-offset-4 hover:underline">
              {copy.login.forgot}
            </Link>
          }
          {...register("password")}
        />
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? copy.login.submitting : copy.login.submit}
          <ArrowRight aria-hidden />
        </Button>
        <FormNotice tone="info">{copy.auth.prototype}</FormNotice>
      </form>
      <p className="my-5 flex items-center gap-3 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">{copy.auth.or}</p>
      <SocialAuthButtons />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {copy.login.noAccount}{" "}
        <Link to="/registro" className="font-bold text-primary underline underline-offset-4">
          {copy.login.create}
        </Link>
      </p>
    </AuthShell>
  );
}
