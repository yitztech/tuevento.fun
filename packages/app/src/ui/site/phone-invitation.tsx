import { tr } from "../../i18n";
import { PhoneFrame } from "./phone-frame";
import { ThemeCard, type SiteTheme } from "./theme-card";

type Props = { theme: SiteTheme; className?: string; eager?: boolean; label?: string };

/** Teléfono con un diseño y la barra de respuesta; solo presentación. */
export function PhoneInvitation({ theme, className, eager, label }: Props) {
  return (
    <PhoneFrame className={className} label={label}>
      <ThemeCard theme={theme} eager={eager} className="rounded-none shadow-none" />
      <div aria-hidden className="flex flex-1 flex-col justify-center gap-[2.4cqw] px-[6cqw] pb-[3cqw]">
        <div className="rounded-full bg-primary py-[2.8cqw] text-center text-[4.4cqw] font-bold text-primary-foreground">
          {tr("site.confirmAttendance")}
        </div>
        <div className="grid grid-cols-3 gap-[1.6cqw] text-center text-[3.2cqw] font-semibold">
          <span className="truncate rounded-[2cqw] border border-coral bg-accent-soft px-[1cqw] py-[1.8cqw] text-primary">
            {tr("landing.attending")}
          </span>
          <span className="truncate rounded-[2cqw] border border-border px-[1cqw] py-[1.8cqw] text-muted-foreground">
            {tr("status.pending")}
          </span>
          <span className="truncate rounded-[2cqw] border border-border px-[1cqw] py-[1.8cqw] text-muted-foreground">
            {tr("landing.notAttending")}
          </span>
        </div>
      </div>
    </PhoneFrame>
  );
}
