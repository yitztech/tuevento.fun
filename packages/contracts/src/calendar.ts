/** Duración por defecto del evento en el calendario: los eventos no guardan hora de fin. */
export const defaultEventMinutes = 120;

/** Fecha en formato UTC de iCalendar, p. ej. 20270612T180000Z. */
export function icsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Escapa el texto según RFC 5545: barras, punto y coma, coma y saltos de línea. */
export function icsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Las líneas de iCalendar no deben pasar de 75 octetos; las más largas continúan con un espacio. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const limit = parts.length ? 74 : 75;
    if (size + bytes > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** Archivo .ics con un solo evento. `uid` debe ser estable para que el calendario lo actualice. */
export function calendarFile(event: {
  uid: string;
  title: string;
  description: string;
  start: Date;
  location: string;
  url?: string;
  cancelled: boolean;
  now?: Date;
}): string {
  const end = new Date(event.start.getTime() + defaultEventMinutes * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TuEventoFun//Eventos//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}@tuevento.fun`,
    `DTSTAMP:${icsDate(event.now ?? new Date())}`,
    `DTSTART:${icsDate(event.start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(event.title)}`,
    ...(event.description ? [`DESCRIPTION:${icsText(event.description)}`] : []),
    ...(event.location ? [`LOCATION:${icsText(event.location)}`] : []),
    ...(event.url ? [`URL:${event.url}`] : []),
    `STATUS:${event.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Enlace para añadir el evento a Google Calendar (sin descargar nada). */
export function googleCalendarUrl(event: {
  title: string;
  description: string;
  start: Date;
  location: string;
}): string {
  const end = new Date(event.start.getTime() + defaultEventMinutes * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${icsDate(event.start)}/${icsDate(end)}`,
    details: event.description,
    location: event.location,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Enlace de búsqueda en Google Maps para la ubicación escrita por el organizador. */
export function mapsSearchUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

/** Dirección pública a partir del título: sin acentos, en minúsculas y con guiones. */
export function slugify(title: string, max = 60): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}
