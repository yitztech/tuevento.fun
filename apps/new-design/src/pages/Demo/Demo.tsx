import { ArrowLeft, ArrowRight, Copy, Link2, Mail, MessageCircle, QrCode, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { FormField } from "@/components/forms/FormField";
import { FormNotice } from "@/components/forms/FormNotice";
import { InvitationCard } from "@/components/invitations/InvitationCard";
import { InvitationCarousel } from "@/components/invitations/InvitationCarousel";
import { PhoneInvitation } from "@/components/invitations/PhoneInvitation";
import { RSVPCard } from "@/components/invitations/RSVPCard";
import { DecorativeBackground } from "@/components/shared/DecorativeBackground";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type Details, defaultDetails, detailsSchema } from "@/features/demo/details";
import { sampleGuests } from "@/features/demo/guests";
import { designById, designs } from "@/features/invitations/designs";
import { cn } from "@/lib/cn";
import { copy } from "@/lib/copy";
import { shortDate } from "@/lib/format";
import type { InvitationTag, RsvpStatus } from "@/types";

const wrap = "mx-auto w-full max-w-page px-4 sm:px-6 lg:px-8";
const tagKeys = (Object.keys(copy.designs.tags) as (InvitationTag | "todos")[]).filter((k) => k !== "elegante" && k !== "celebracion");

export function Demo() {
  const [step, setStep] = useState(0);
  const [designId, setDesignId] = useState(designs[0].id);
  const [tag, setTag] = useState<InvitationTag | "todos">("todos");
  const [details, setDetails] = useState<Details>(defaultDetails);
  const [errors, setErrors] = useState<Partial<Record<keyof Details, string>>>({});
  const [guests, setGuests] = useState(sampleGuests);
  const [status, setStatus] = useState("");

  const design = designById(designId);
  const shown = tag === "todos" ? designs : designs.filter((d) => d.tags.includes(tag));
  const set = (k: keyof Details) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDetails((d) => ({ ...d, [k]: e.target.value }));

  const next = () => {
    if (step === 1) {
      const r = detailsSchema.safeParse(details);
      if (!r.success) {
        const flat = r.error.flatten().fieldErrors;
        setErrors(Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, v?.[0]])));
        return;
      }
      setErrors({});
    }
    setStep((s) => Math.min(3, s + 1));
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(copy.demo.sampleLink);
      setStatus(copy.demo.copied);
    } catch {
      setStatus(copy.demo.copyFailed);
    }
  };
  const restart = () => {
    setStep(0);
    setDetails(defaultDetails);
    setDesignId(designs[0].id);
    setGuests(sampleGuests());
    setStatus("");
    setErrors({});
  };

  const stepInfo = [copy.demo.step1, copy.demo.step2, copy.demo.step3, copy.demo.step4][step];
  const channels = [
    { id: "whatsapp", label: copy.demo.channels.whatsapp, icon: MessageCircle },
    { id: "email", label: copy.demo.channels.email, icon: Mail },
    { id: "qr", label: copy.demo.channels.qr, icon: QrCode },
  ];

  return (
    <>
      <section aria-labelledby="demo-title" className="relative isolate overflow-hidden">
        <DecorativeBackground piece="balloons" className="-z-10 hidden lg:block" />
        <div className={cn(wrap, "grid items-center gap-6 pt-8 pb-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:pt-12")}>
          <div className="max-w-xl">
            <p className="eyebrow mb-3">{copy.demo.eyebrow}</p>
            <h1 id="demo-title" className="display-title !text-[clamp(2.2rem,1.5rem+3.2vw,3.9rem)]">
              {copy.demo.title}
            </h1>
            <p className="mt-4 max-w-lg text-base text-foreground/90">{copy.demo.text}</p>
            <div className="mt-5 max-w-lg">
              <FormNotice tone="info">{copy.demo.simulation}</FormNotice>
            </div>
          </div>
          <div aria-hidden className="relative hidden h-56 lg:block">
            <div className="absolute top-2 left-[8%] w-[22%]">
              <InvitationCard design={designById("cumpleanos-globos")} tilt={-9} />
            </div>
            <div className="absolute top-0 left-[34%] w-[22%] z-10">
              <InvitationCard design={designById("boda-floral")} />
            </div>
            <div className="absolute top-3 left-[60%] w-[22%]">
              <InvitationCard design={designById("noche-bokeh")} tilt={8} />
            </div>
          </div>
        </div>
      </section>

      <section aria-label={copy.demo.stepsLabel} className={wrap}>
        <ol className="grid grid-cols-4 gap-1 rounded-2xl border border-white/70 bg-card/80 p-2 shadow-card sm:gap-2 sm:p-3">
          {copy.demo.steps.map((label, i) => (
            <li key={label}>
              <button
                type="button"
                aria-current={step === i ? "step" : undefined}
                onClick={() => setStep(i)}
                className={cn("flex min-h-12 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl px-1 text-[0.7rem] font-semibold transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 sm:flex-row sm:gap-2.5 sm:px-3 sm:text-sm", step === i ? "bg-accent-soft text-primary" : "text-muted-foreground hover:bg-accent-soft/50")}
              >
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold", step >= i ? "bg-primary text-primary-foreground" : "bg-muted text-primary")}>{i + 1}</span>
                <span className="text-center leading-tight">{label}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="demo-step" className={cn(wrap, "pt-4 pb-6")}>
        <div className="grid gap-6 rounded-2xl border border-white/70 bg-card/75 p-5 shadow-card sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,17rem)] lg:gap-10">
          <div className="min-w-0">
            <h2 id="demo-step" className="font-serif text-xl font-semibold text-title sm:text-2xl">
              {stepInfo.title}
            </h2>
            <p className="mt-1 mb-5 text-sm text-muted-foreground">{stepInfo.text}</p>

            {step === 0 && (
              <div className="grid gap-4 md:grid-cols-[9rem_minmax(0,1fr)]">
                <div role="group" aria-label={copy.designs.filters} className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] md:flex-col md:overflow-visible [&::-webkit-scrollbar]:hidden">
                  {tagKeys.map((k) => (
                    <button key={k} type="button" aria-pressed={tag === k} onClick={() => setTag(k)} className={cn("min-h-10 shrink-0 cursor-pointer rounded-md px-3 text-left text-sm font-semibold transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40", tag === k ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent-soft")}>
                      {copy.designs.tags[k]}
                    </button>
                  ))}
                </div>
                <div className="min-w-0">
                  {shown.length ? <InvitationCarousel designs={shown} selectedId={designId} onSelect={setDesignId} itemClass="w-[44%] sm:w-[30%] md:w-[28%] lg:w-[26%]" /> : <p className="text-sm text-muted-foreground">{copy.designs.empty}</p>}
                </div>
              </div>
            )}

            {step === 1 && (
              <form noValidate onSubmit={(e) => e.preventDefault()} className="grid gap-4 sm:grid-cols-2">
                <FormField label={copy.demo.fields.name} error={errors.name} className="sm:col-span-2">
                  {(c) => <Input {...c} value={details.name} onChange={set("name")} maxLength={150} autoComplete="off" />}
                </FormField>
                <FormField label={copy.demo.fields.date} error={errors.date}>
                  {(c) => <Input {...c} type="date" value={details.date} onChange={set("date")} />}
                </FormField>
                <FormField label={copy.demo.fields.time} error={errors.time}>
                  {(c) => <Input {...c} type="time" value={details.time} onChange={set("time")} />}
                </FormField>
                <FormField label={copy.demo.fields.place} error={errors.place} className="sm:col-span-2">
                  {(c) => <Input {...c} value={details.place} onChange={set("place")} maxLength={200} autoComplete="off" />}
                </FormField>
                <FormField label={copy.demo.fields.message} error={errors.message} className="sm:col-span-2">
                  {(c) => <Textarea {...c} value={details.message} onChange={set("message")} maxLength={2000} />}
                </FormField>
              </form>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {channels.map((ch) => (
                    <li key={ch.id}>
                      <Button variant="outline" className="h-auto min-h-20 w-full flex-col gap-2 py-3" onClick={() => setStatus(copy.demo.sent(ch.label))}>
                        <ch.icon aria-hidden className="size-6 text-primary" />
                        {ch.label}
                      </Button>
                    </li>
                  ))}
                  <li>
                    <Button variant="outline" className="h-auto min-h-20 w-full flex-col gap-2 py-3" onClick={copyLink}>
                      <Link2 aria-hidden className="size-6 text-primary" />
                      {copy.demo.channels.link}
                    </Button>
                  </li>
                </ul>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input readOnly aria-label={copy.demo.channels.link} value={copy.demo.sampleLink} onFocus={(e) => e.currentTarget.select()} />
                  <Button onClick={copyLink} className="sm:shrink-0">
                    <Copy aria-hidden />
                    {copy.demo.copy}
                  </Button>
                </div>
                <p role="status" className="min-h-5 text-sm font-semibold text-primary">
                  {status}
                </p>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <RSVPCard guests={guests} onChange={(id, s: RsvpStatus) => setGuests((g) => g.map((x) => (x.id === id ? { ...x, status: s } : x)))} showHeader={false} className="border-0 p-0 shadow-none" />
                <div className="flex flex-col gap-3 rounded-xl bg-accent-soft/70 p-4 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <p className="font-serif text-base font-semibold text-title">{copy.demo.cta.title}</p>
                    <p className="text-sm text-muted-foreground">{copy.demo.cta.text}</p>
                  </div>
                  <Button asChild size="lg">
                    <Link to="/registro">
                      {copy.demo.cta.button}
                      <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/80 pt-4">
              <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                <ArrowLeft aria-hidden />
                {copy.demo.back}
              </Button>
              {step < 3 ? (
                <Button onClick={next}>
                  {copy.demo.next}
                  <ArrowRight aria-hidden />
                </Button>
              ) : (
                <Button variant="outline" onClick={restart}>
                  <RotateCcw aria-hidden />
                  {copy.demo.restart}
                </Button>
              )}
            </div>
          </div>

          <div className="mx-auto w-full max-w-[15rem] lg:sticky lg:top-24 lg:self-start">
            <PhoneInvitation design={design} title={step === 0 ? undefined : details.name || undefined} caption={step === 0 ? undefined : shortDate(details.date)} place={step === 0 ? undefined : details.place} label={copy.demo.previewLabel} />
          </div>
        </div>
      </section>
    </>
  );
}
