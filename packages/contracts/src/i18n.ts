import english from "./locales/en.json";
export type Locale = "es" | "en";
export const englishMessages: Record<string, string> = english;
export const supportedLocales: readonly Locale[] = ["es", "en"];
export function normalizeLocale(value?: string | null): Locale {
  return value?.toLowerCase().startsWith("en") ? "en" : "es";
}
/** Server-side translation for fixed messages; user content must never pass here. */
export function translateMessage(message: string, locale: Locale): string {
  return locale === "en" ? englishMessages[message] || message : message;
}
export function notificationMessage(
  counts: { accepted: number; declined: number; pending: number },
  locale: Locale,
): string {
  return locale === "en"
    ? `${counts.accepted} attending, ${counts.declined} not attending and ${counts.pending} pending.`
    : `${counts.accepted} ${counts.accepted === 1 ? "confirmado" : "confirmados"}, ${counts.declined} no ${counts.declined === 1 ? "asistirá" : "asistirán"} y ${counts.pending} en espera.`;
}
