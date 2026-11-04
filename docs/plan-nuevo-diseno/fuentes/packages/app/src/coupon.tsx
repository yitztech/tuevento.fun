import { useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { accountLimits, type AppliedCoupon } from "@tuevento/contracts";
import { ErrorBox } from "./components";
import { errorText, useApp } from "./context";
import { tr } from "./i18n";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

/** Campo del cupón en la página de pago: lo comprueba y avisa de lo que descuenta. */
export function CouponField({ coupon, onChange }: { coupon: AppliedCoupon | null; onChange: (coupon: AppliedCoupon | null) => void }) {
  const { api } = useApp(),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [discarded, setDiscarded] = useState(false);
  const write = (value: string) => {
    const clean = value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    setDiscarded(clean !== value.toUpperCase());
    setCode(clean);
  };
  const apply = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onChange(await api.checkCoupon(code));
      setCode("");
      setDiscarded(false);
    } catch (e) {
      setError(errorText(e));
    }
    setBusy(false);
  };
  if (coupon)
    return (
      <div className="coupon-applied">
        <p className="success-box" role="status">
          <CheckCircle2 size={18} />
          {tr("pricing.couponApplied", { code: coupon.code })}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(null)}>
          {tr("pricing.couponRemove")}
        </Button>
      </div>
    );
  return (
    <form className="coupon-form" onSubmit={(event) => void apply(event)}>
      <Label htmlFor="coupon-code">{tr("pricing.couponLabel")}</Label>
      <div className="coupon-form-row">
        <Input
          id="coupon-code"
          value={code}
          maxLength={accountLimits.couponCode}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-describedby={discarded ? "coupon-code-hint" : undefined}
          onChange={(event) => write(event.target.value)}
        />
        <Button type="submit" variant="outline" disabled={busy || code.length < 3}>
          {busy ? tr("pricing.couponChecking") : tr("pricing.couponApply")}
        </Button>
      </div>
      {discarded && <small id="coupon-code-hint">{tr("pricing.couponHint")}</small>}
      {error && <ErrorBox message={error} />}
    </form>
  );
}
