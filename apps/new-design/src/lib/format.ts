const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

/** «2026-12-12» → «12 · DIC · 2026». Devuelve el texto tal cual si no es una fecha válida. */
export function shortDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])} · ${months[Number(m[2]) - 1]} · ${m[1]}`;
}

export function longDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

export function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase();
}
