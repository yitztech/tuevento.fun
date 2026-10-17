import { CalendarPlus, ExternalLink } from "lucide-react";
import { tr } from "./i18n";

/** Añadir el evento al calendario: archivo .ics (Apple, Outlook, Google) o enlace directo a Google. */
export function CalendarLinks({ icsHref, googleHref }: { icsHref: string; googleHref: string }) {
  return (
    <div className="calendar-links">
      <a className="button secondary" href={icsHref} download>
        <CalendarPlus size={17} />
        {tr("calendar.downloadIcs")}
      </a>
      <a className="button secondary" href={googleHref} target="_blank" rel="noreferrer">
        {tr("calendar.googleCalendar")}
        <ExternalLink size={14} />
      </a>
    </div>
  );
}
