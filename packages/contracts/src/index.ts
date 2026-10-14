import { z } from "zod";
z.config(z.locales.es());

export const themeIds = [
  "gold",
  "neon",
  "tropical",
  "minimal",
  "floral",
  "kids",
] as const;
export const statusSchema = z.enum(["accepted", "declined", "pending"]);
export type Status = z.infer<typeof statusSchema>;
export const themes = [
  {
    id: "gold",
    name: "Elegante Dorado",
    description: "Brindis que merecen brillar",
    image: "gold.jpg",
    color: "#d9b967",
  },
  {
    id: "neon",
    name: "Fiesta Neón",
    description: "La noche apenas empieza",
    image: "neon.jpg",
    color: "#b3a0ec",
  },
  {
    id: "tropical",
    name: "Tropical",
    description: "Al sol, entre amigos",
    image: "tropical.jpg",
    color: "#92a2c8",
  },
  {
    id: "minimal",
    name: "Minimalista",
    description: "Lo especial está en los detalles",
    image: "minimal.jpg",
    color: "#bfccdc",
  },
  {
    id: "floral",
    name: "Bodas Florales",
    description: "Un sí lleno de flores",
    image: "floral.jpg",
    color: "#edb7c9",
  },
  {
    id: "kids",
    name: "Infantil",
    description: "Un mundo por celebrar",
    image: "kids.jpg",
    color: "#f3d579",
  },
] as const;
const email = z
  .email("Escribe un correo válido.")
  .max(254)
  .transform((v) => v.toLowerCase().trim());
const phone = z
  .string()
  .trim()
  .min(7, "Escribe un teléfono válido.")
  .max(25)
  .regex(/^[+\d\s()-]+$/, "Usa números, espacios o +.");
const optionalEmail = z
  .union([email, z.literal("")])
  .optional()
  .default("");
const optionalPhone = z
  .union([phone, z.literal("")])
  .optional()
  .default("");
const name = z
  .string()
  .trim()
  .min(2, "Escribe al menos 2 caracteres.")
  .max(100, "Máximo 100 caracteres.");
export const registerSchema = z.object({
  firstName: name,
  lastName: name,
  email,
  phone,
  username: z
    .string()
    .trim()
    .min(3, "Usa al menos 3 caracteres.")
    .max(32, "Usa como máximo 32 caracteres.")
    .regex(/^[a-zA-Z0-9_.-]+$/, "Usa letras, números, punto o guion."),
  password: z.string().min(10, "Usa al menos 10 caracteres.").max(128),
});
export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Escribe tu contraseña.").max(128),
});
export const profileSchema = z.object({
  firstName: name,
  lastName: name,
  phone: optionalPhone,
  username: z
    .string()
    .trim()
    .min(3, "Usa al menos 3 caracteres.")
    .max(32, "Usa como máximo 32 caracteres.")
    .regex(/^[a-zA-Z0-9_.-]+$/),
});
/** Rutas de recuperación de contraseña (iguales en los dos dominios, como /acceso). */
export const passwordResetPaths = {
  request: "/recuperar-contrasena",
  reset: "/nueva-contrasena",
} as const;
/** Minutos de validez del enlace para restablecer la contraseña. */
export const PASSWORD_RESET_MINUTES = 60;
export const forgotPasswordSchema = z.object({ email });
export const resetPasswordSchema = z.object({
  token: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/, "El enlace para cambiar la contraseña no es válido o caducó."),
  password: z.string().min(10, "Usa al menos 10 caracteres.").max(128),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export const newsletterSchema = z.object({
  email,
  name: z.string().trim().max(100).optional(),
});
export type NewsletterInput = z.infer<typeof newsletterSchema>;
export const eventSchema = z.object({
  title: name,
  description: z.string().trim().max(2500).default(""),
  date: z.iso.datetime({
    offset: true,
    message: "Selecciona fecha y hora válidas.",
  }),
  timeZone: z
    .string()
    .default("America/Mexico_City")
    .refine((v) => {
      try {
        new Intl.DateTimeFormat("es", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, "Zona horaria inválida."),
  location: z.string().trim().min(3, "Indica el lugar del evento.").max(300),
  theme: z.enum(themeIds),
  archived: z.boolean().default(false),
});
export const memberSchema = z.object({
  id: z.uuid().optional(),
  name,
  kind: z.enum(["adult", "child"]),
  notes: z.string().trim().max(500).default(""),
});
export const invitationSchema = z
  .object({
    name: z.string().trim().max(120).default(""),
    email: optionalEmail,
    phone: optionalPhone,
    notes: z.string().trim().max(1000).default(""),
    kind: z.enum(["individual", "family"]),
    members: z
      .array(memberSchema)
      .min(1, "Añade al menos una persona.")
      .max(50),
  })
  .superRefine((v, ctx) => {
    if (!v.name && !v.email && !v.phone)
      ctx.addIssue({
        code: "custom",
        path: ["name"],
        message: "Indica nombre, teléfono o correo.",
      });
    if (v.kind === "individual" && v.members.length !== 1)
      ctx.addIssue({
        code: "custom",
        path: ["members"],
        message: "Una invitación individual tiene una persona.",
      });
    const ids = v.members.map((m) => m.id).filter(Boolean);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        path: ["members"],
        message: "Hay integrantes repetidos.",
      });
  });
export const rsvpSchema = z
  .object({
    members: z
      .array(z.object({ id: z.uuid(), status: statusSchema }))
      .min(1)
      .max(50),
  })
  .refine(
    (v) => new Set(v.members.map((m) => m.id)).size === v.members.length,
    "Hay integrantes repetidos.",
  );
export type EventInput = z.infer<typeof eventSchema>;
export type InvitationInput = z.infer<typeof invitationSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  username: string;
  avatar: string | null;
  isOwner?: boolean;
  isDemo: boolean;
  /** Idioma de la cuenta: el del dominio donde se registró. */
  locale: "es" | "en";
};
export type Metrics = {
  invitations: number;
  people: number;
  adults: number;
  children: number;
  accepted: number;
  declined: number;
  pending: number;
};
export type Event = EventInput & {
  id: string;
  createdAt: string;
  metrics: Metrics;
};
export type Member = {
  id: string;
  name: string;
  kind: "adult" | "child";
  notes: string;
  status: Status;
};
export type Invitation = {
  id: string;
  eventId: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  kind: "individual" | "family";
  token: string;
  members: Member[];
  createdAt: string;
};
export type Notification = {
  id: string;
  eventId: string;
  eventTitle: string;
  guestName: string;
  message: string;
  read: boolean;
  createdAt: string;
};
export type PublicInvitation = {
  name: string;
  kind: "individual" | "family";
  event: Pick<
    Event,
    "title" | "description" | "date" | "timeZone" | "location" | "theme"
  >;
  host: Pick<User, "firstName" | "lastName" | "avatar">;
  members: Pick<Member, "id" | "name" | "kind" | "status">[];
  isDemo: boolean;
};
export const emptyMetrics = (): Metrics => ({
  invitations: 0,
  people: 0,
  adults: 0,
  children: 0,
  accepted: 0,
  declined: 0,
  pending: 0,
});
export function countMetrics(
  invitations: { members: Pick<Member, "kind" | "status">[] }[],
): Metrics {
  const result = emptyMetrics();
  result.invitations = invitations.length;
  for (const invitation of invitations)
    for (const member of invitation.members) {
      result.people++;
      result[member.kind === "adult" ? "adults" : "children"]++;
      result[member.status]++;
    }
  return result;
}
export const statusLabels: Record<Status, string> = {
  accepted: "Confirmados",
  declined: "No asistirán",
  pending: "En espera",
};

export * from "./i18n";

/** Per-parse locale: no global language mutation across simultaneous API requests. */
export const validationOptions = (locale: "es" | "en") => ({
  error: (locale === "en" ? z.locales.en() : z.locales.es()).localeError,
});

export const clientPlatformSchema = z.enum(["web", "android", "ios"]);
export type ClientPlatform = z.infer<typeof clientPlatformSchema>;
export const visitSchema = z.object({ visitorId: z.uuid(), route: z.enum(["landing", "downloads", "app"]), visitId: z.uuid() });
export const releaseSchema = z.object({
  platform: z.enum(["android", "ios"]), version: z.string().regex(/^\d+\.\d+\.\d+$/),
  build: z.number().int().positive(), channel: z.enum(["direct", "testflight", "store"]),
  url: z.url().refine(v => new URL(v).protocol === "https:", "Usa HTTPS."),
  sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(), notes: z.string().max(2000).default(""),
}).superRefine((v, ctx) => {
  const host = new URL(v.url).hostname;
  if (v.platform === "ios" && !(v.channel === "testflight" && host === "testflight.apple.com" || v.channel === "store" && host === "apps.apple.com"))
    ctx.addIssue({code:"custom", message:"iOS requiere TestFlight o App Store."});
  if (v.platform === "android" && (v.channel === "testflight" || v.channel === "direct" && !v.sha256 || v.channel === "store" && host !== "play.google.com"))
    ctx.addIssue({code:"custom", message:"Revisa el canal y la suma SHA-256 de Android."});
});
export type AppRelease = z.infer<typeof releaseSchema> & { id: string; publishedAt: string };
export type OwnerMetrics = {
  days: number; totals: { visitors: number; visits: number; registrations: number; logins: number; downloads: number };
  sources: { platform: ClientPlatform; visits: number; registrations: number; logins: number; downloads: number }[];
  daily: { day: string; visits: number; registrations: number; logins: number; downloads: number }[];
};
