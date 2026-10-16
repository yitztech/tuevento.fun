import { z } from "zod";
import { defaultLocale, locales, type Locale, type MessageKey } from "./i18n";
z.config(z.locales[locales[defaultLocale].zod]());

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
    name: "themes.gold.name",
    description: "themes.gold.description",
    image: "gold.jpg",
    color: "#d9b967",
  },
  {
    id: "neon",
    name: "themes.neon.name",
    description: "themes.neon.description",
    image: "neon.jpg",
    color: "#b3a0ec",
  },
  {
    id: "tropical",
    name: "themes.tropical.name",
    description: "themes.tropical.description",
    image: "tropical.jpg",
    color: "#92a2c8",
  },
  {
    id: "minimal",
    name: "themes.minimal.name",
    description: "themes.minimal.description",
    image: "minimal.jpg",
    color: "#bfccdc",
  },
  {
    id: "floral",
    name: "themes.floral.name",
    description: "themes.floral.description",
    image: "floral.jpg",
    color: "#edb7c9",
  },
  {
    id: "kids",
    name: "themes.kids.name",
    description: "themes.kids.description",
    image: "kids.jpg",
    color: "#f3d579",
  },
] as const;
/** Longitudes máximas de los datos de cuenta; el frontend las usa como `maxLength`. */
export const accountLimits = {
  personName: 50,
  email: 254,
  phone: 20,
  password: 128,
} as const;
const email = z
  .email("validation.enterValidEmailAddress")
  .max(accountLimits.email, "validation.maximum254Characters")
  .transform((v) => v.toLowerCase().trim());
const phone = z
  .string()
  .trim()
  .min(7, "validation.enterValidPhoneNumber")
  .max(accountLimits.phone, "validation.maximum20Characters")
  .regex(/^\+?[\d\s()-]+$/, "validation.useNumbersSpaces")
  .refine((v) => {
    const digits = v.replace(/\D/g, "").length;
    return digits >= 7 && digits <= 15;
  }, "validation.enterValidPhoneNumber");
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
  .min(2, "validation.enterLeast2Characters")
  .max(100, "validation.maximum100Characters");
/** Nombres y apellidos de personas: letras de cualquier idioma, espacios, apóstrofo, punto y guion. */
const personName = name
  .max(accountLimits.personName, "validation.maximum50Characters")
  .regex(
  /^\p{L}[\p{L}\p{M}\s'’.-]*$/u,
  "validation.useLettersSpaces",
);
/** Contraseña: la misma regla al crear cuenta, al entrar y al restablecerla. */
const password = z
  .string()
  .min(10, "validation.useLeast10Characters")
  .max(accountLimits.password, "validation.maximum128Characters");
export const registerSchema = z.object({
  firstName: personName,
  lastName: personName,
  email,
  phone,
  password,
});
export const loginSchema = z.object({
  email,
  password,
});
export const profileSchema = z.object({
  firstName: personName,
  lastName: personName,
  phone: optionalPhone,
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
    .regex(/^[A-Za-z0-9_-]{43}$/, "common.passwordResetLinkInvalid"),
  password,
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
    message: "validation.chooseValidDateTime",
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
    }, "validation.invalidTimeZone"),
  location: z.string().trim().min(3, "validation.enterEventLocation").max(300),
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
      .min(1, "validation.addLeastOnePerson")
      .max(50),
  })
  .superRefine((v, ctx) => {
    if (!v.name && !v.email && !v.phone)
      ctx.addIssue({
        code: "custom",
        path: ["name"],
        message: "validation.enterNamePhoneNumber",
      });
    if (v.kind === "individual" && v.members.length !== 1)
      ctx.addIssue({
        code: "custom",
        path: ["members"],
        message: "validation.individualInvitationMustHave",
      });
    const ids = v.members.map((m) => m.id).filter(Boolean);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        path: ["members"],
        message: "validation.thereDuplicateMembers",
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
    "validation.thereDuplicateMembers",
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
  avatar: string | null;
  isOwner?: boolean;
  isDemo: boolean;
  /** Idioma de la cuenta: el del dominio donde se registró. */
  locale: Locale;
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
export const statusLabels = {
  accepted: "status.accepted",
  declined: "status.declined",
  pending: "status.pending",
} as const satisfies Record<Status, MessageKey>;

export * from "./i18n";
export * from "./pricing";

export const clientPlatformSchema = z.enum(["web", "android", "ios"]);
export type ClientPlatform = z.infer<typeof clientPlatformSchema>;
export const visitSchema = z.object({ visitorId: z.uuid(), route: z.enum(["landing", "downloads", "app"]), visitId: z.uuid() });
export const releaseSchema = z.object({
  platform: z.enum(["android", "ios"]), version: z.string().regex(/^\d+\.\d+\.\d+$/),
  build: z.number().int().positive(), channel: z.enum(["direct", "testflight", "store"]),
  url: z.url().refine(v => new URL(v).protocol === "https:", "validation.useHttps"),
  sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(), notes: z.string().max(2000).default(""),
}).superRefine((v, ctx) => {
  const host = new URL(v.url).hostname;
  if (v.platform === "ios" && !(v.channel === "testflight" && host === "testflight.apple.com" || v.channel === "store" && host === "apps.apple.com"))
    ctx.addIssue({code:"custom", message:"validation.iosRequiresTestflightApp"});
  if (v.platform === "android" && (v.channel === "testflight" || v.channel === "direct" && !v.sha256 || v.channel === "store" && host !== "play.google.com"))
    ctx.addIssue({code:"custom", message:"Revisa el canal y la suma SHA-256 de Android."});
});
export type AppRelease = z.infer<typeof releaseSchema> & { id: string; publishedAt: string };
export type OwnerMetrics = {
  days: number; totals: { visitors: number; visits: number; registrations: number; logins: number; downloads: number };
  sources: { platform: ClientPlatform; visits: number; registrations: number; logins: number; downloads: number }[];
  daily: { day: string; visits: number; registrations: number; logins: number; downloads: number }[];
};
