import { InvitationCard } from "@/components/invitations/InvitationCard";
import { PhoneFrame } from "@/components/invitations/PhoneFrame";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy";
import type { InvitationDesign } from "@/types";

type Props = {
  design: InvitationDesign;
  title?: string;
  caption?: string;
  place?: string;
  className?: string;
  eager?: boolean;
  label?: string;
};

/** Teléfono con la invitación y la barra de respuesta, solo presentación. */
export function PhoneInvitation({ design, title, caption, place, className, eager, label }: Props) {
  return (
    <PhoneFrame className={className} label={label}>
      <InvitationCard design={design} title={title} caption={caption} eager={eager} className="aspect-[2/3] rounded-none shadow-none" />
      <div aria-hidden className="flex flex-1 flex-col justify-center gap-[2.4cqw] px-[6cqw] pb-[3cqw]">
        {place && <p className="truncate text-center text-[3.6cqw] text-muted-foreground">{place}</p>}
        <div className="rounded-full bg-primary py-[2.8cqw] text-center text-[4.4cqw] font-bold text-primary-foreground">{copy.demo.confirm}</div>
        <div className="grid grid-cols-3 gap-[1.6cqw] text-center text-[3.2cqw] font-semibold">
          <span className="rounded-[2cqw] border border-secondary bg-accent-soft py-[1.8cqw] text-primary">{copy.rsvp.attending}</span>
          <span className={cn("rounded-[2cqw] border border-border py-[1.8cqw] text-muted-foreground")}>{copy.rsvp.waiting}</span>
          <span className="rounded-[2cqw] border border-border py-[1.8cqw] text-muted-foreground">{copy.rsvp.declined}</span>
        </div>
      </div>
    </PhoneFrame>
  );
}
