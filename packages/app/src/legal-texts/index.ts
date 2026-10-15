import type { Locale } from "@tuevento/contracts";
import type { LegalTexts } from "./types";
import { es } from "./es";
import { en } from "./en";
import { pt } from "./pt";
import { de } from "./de";
export type * from "./types";

/** Un juego de textos legales por idioma: añadir un idioma sin ellos no compila. */
export const legalTexts: Record<Locale, LegalTexts> = { es, en, pt, de };
