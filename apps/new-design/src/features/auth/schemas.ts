import { z } from "zod";
import { copy } from "@/lib/copy";

// Límites de §6.3 de AGENTS.md: correo 254, contraseña 128, nombre 100.
export const limits = { email: 254, password: 128, name: 100, message: 2000 } as const;

const email = z
  .string()
  .trim()
  .min(1, copy.auth.required)
  .max(limits.email, copy.auth.tooLong(limits.email))
  .pipe(z.email(copy.auth.invalidEmail));

export const emailSchema = z.object({ email });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, copy.auth.required).max(limits.password, copy.auth.tooLong(limits.password)),
});

// Mismo patrón de nombres que §6.2 (letras de cualquier idioma, espacios, apóstrofo, guion y punto).
const namePattern = /^[\p{L}\p{M}](?:[\p{L}\p{M} '’.-]*[\p{L}\p{M}.])?$/u;

// Sin confirmación de contraseña: el campo tiene botón para mostrarla, como en la referencia.
export const registerSchema = z.object({
  name: z.string().trim().min(1, copy.auth.required).max(limits.name, copy.auth.tooLong(limits.name)).regex(namePattern, copy.register.invalidName),
  email,
  password: z.string().min(8, copy.auth.minPassword).max(limits.password, copy.auth.tooLong(limits.password)),
  terms: z.boolean().refine((v) => v, copy.register.termsRequired),
  news: z.boolean(),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type EmailValues = z.infer<typeof emailSchema>;
