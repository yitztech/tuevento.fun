import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { defaultLocale, locales, type Locale, type MessageKey } from "./i18n";
import { isMapLinkHost } from "./geo";
z.config(z.locales[locales[defaultLocale].zod]());

export const themeIds = [
  "gold",
  "neon",
  "tropical",
  "minimal",
  "floral",
  "kids",
  "winter",
  "spring",
  "autumn",
  "silver",
  "copper",
  "disco",
  "starlight",
  "sand",
  "wildflower",
  "pastel",
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
    previewTitle: "dashboard.nightRemember",
  },
  {
    id: "neon",
    name: "themes.neon.name",
    description: "themes.neon.description",
    image: "neon.jpg",
    color: "#b3a0ec",
    previewTitle: "dashboard.tonightOurs",
  },
  {
    id: "tropical",
    name: "themes.tropical.name",
    description: "themes.tropical.description",
    image: "tropical.jpg",
    color: "#92a2c8",
    previewTitle: "dashboard.underSameSun",
  },
  {
    id: "minimal",
    name: "themes.minimal.name",
    description: "themes.minimal.description",
    image: "minimal.jpg",
    color: "#bfccdc",
    previewTitle: "dashboard.celebrateSimpleThings",
  },
  {
    id: "floral",
    name: "themes.floral.name",
    description: "themes.floral.description",
    image: "floral.jpg",
    color: "#edb7c9",
    previewTitle: "dashboard.doForever",
  },
  {
    id: "kids",
    name: "themes.kids.name",
    description: "themes.kids.description",
    image: "kids.jpg",
    color: "#f3d579",
    previewTitle: "dashboard.makeWish",
  },
  {
    id: "winter",
    name: "themes.winter.name",
    description: "themes.winter.description",
    image: "winter.webp",
    smallImage: "winter-640.webp",
    color: "#c9dce8",
    previewTitle: "themes.winter.title",
  },
  {
    id: "spring",
    name: "themes.spring.name",
    description: "themes.spring.description",
    image: "spring.webp",
    smallImage: "spring-640.webp",
    color: "#d9e5cf",
    previewTitle: "themes.spring.title",
  },
  {
    id: "autumn",
    name: "themes.autumn.name",
    description: "themes.autumn.description",
    image: "autumn.webp",
    smallImage: "autumn-640.webp",
    color: "#edcbb0",
    previewTitle: "themes.autumn.title",
  },
  {
    id: "silver",
    name: "themes.silver.name",
    description: "themes.silver.description",
    image: "silver.webp",
    smallImage: "silver-640.webp",
    color: "#dce1e8",
    previewTitle: "themes.silver.title",
  },
  {
    id: "copper",
    name: "themes.copper.name",
    description: "themes.copper.description",
    image: "copper.webp",
    smallImage: "copper-640.webp",
    color: "#e7c3ae",
    previewTitle: "themes.copper.title",
  },
  {
    id: "disco",
    name: "themes.disco.name",
    description: "themes.disco.description",
    image: "disco.webp",
    smallImage: "disco-640.webp",
    color: "#bba2cc",
    previewTitle: "themes.disco.title",
  },
  {
    id: "starlight",
    name: "themes.starlight.name",
    description: "themes.starlight.description",
    image: "starlight.webp",
    smallImage: "starlight-640.webp",
    color: "#8b9ac0",
    previewTitle: "themes.starlight.title",
  },
  {
    id: "sand",
    name: "themes.sand.name",
    description: "themes.sand.description",
    image: "sand.webp",
    smallImage: "sand-640.webp",
    color: "#e3d7c5",
    previewTitle: "themes.sand.title",
  },
  {
    id: "wildflower",
    name: "themes.wildflower.name",
    description: "themes.wildflower.description",
    image: "wildflower.webp",
    smallImage: "wildflower-640.webp",
    color: "#dcd4e9",
    previewTitle: "themes.wildflower.title",
  },
  {
    id: "pastel",
    name: "themes.pastel.name",
    description: "themes.pastel.description",
    image: "pastel.webp",
    smallImage: "pastel-640.webp",
    color: "#f1d3df",
    previewTitle: "themes.pastel.title",
  },
] as const;
/** Longitudes máximas de los datos de cuenta; el frontend las usa como `maxLength`. */
export const accountLimits = {
  personName: 50,
  email: 254,
  phone: 20,
  password: 128,
  postcardText: 200,
  eventSlug: 60,
  /** Texto con el que se busca un lugar en el mapa (sin columna: no se guarda). */
  geoQuery: 200,
  /** Enlace de mapas que se pega para fijar un punto (sin columna). */
  url: 2048,
} as const;
/** Punto en el mapa (WGS 84). */
export const geoPointSchema = z.strictObject({
  lat: z.number().min(-90, "validation.invalidCoordinates").max(90, "validation.invalidCoordinates"),
  lng: z.number().min(-180, "validation.invalidCoordinates").max(180, "validation.invalidCoordinates"),
});
export type GeoPoint = z.infer<typeof geoPointSchema>;
/** Búsqueda de un lugar por texto (`GET /api/geo/search`). */
export const geoSearchSchema = z.strictObject({
  q: z
    .string()
    .trim()
    .min(3, "validation.useLeast3Characters")
    .max(accountLimits.geoQuery, "validation.maximum200Characters"),
});
/** Dirección de un punto (`GET /api/geo/reverse`), con las coordenadas como texto de la URL. */
export const geoReverseSchema = z.strictObject({
  lat: z.coerce.number().min(-90, "validation.invalidCoordinates").max(90, "validation.invalidCoordinates"),
  lng: z.coerce.number().min(-180, "validation.invalidCoordinates").max(180, "validation.invalidCoordinates"),
});
/** Enlace de mapas pegado (`POST /api/geo/parse-link`). */
export const geoLinkSchema = z.strictObject({
  url: z
    .string()
    .trim()
    .max(accountLimits.url, "validation.maximum2048Characters")
    .refine((v) => {
      try {
        const u = new URL(v);
        return u.protocol === "https:" && isMapLinkHost(u.hostname);
      } catch {
        return false;
      }
    }, "validation.mapLinkNotSupported"),
});
/** Dirección de un evento: minúsculas, números y guiones entre palabras. */
export const eventSlugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** Código público de una cuenta, primera parte de la URL de sus landings (users.public_code). */
export const publicCodePattern = /^[a-z0-9]{8}$/;
/** Landing de un evento: /<código de la cuenta>/<dirección>, detrás del prefijo del idioma. */
export const eventLandingPath = (code: string, slug: string) => `/${code}/${slug}`;
/** Reconoce una ruta de landing y devuelve sus dos partes. */
export function landingRoute(pathname: string): { code: string; slug: string } | null {
  const match = /^\/([a-z0-9]{8})\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(pathname);
  return match ? { code: match[1], slug: match[2] } : null;
}
const email = z
  .email("validation.enterValidEmailAddress")
  .max(accountLimits.email, "validation.maximum254Characters")
  .transform((v) => v.toLowerCase().trim());
/** País de los teléfonos escritos sin prefijo internacional (el del idioma principal). */
export const defaultPhoneCountry = "ES";
/** Teléfono (§6.2): solo sus caracteres, válido según libphonenumber y guardado en E.164. */
const phone = z
  .string()
  .trim()
  .min(7, "validation.enterValidPhoneNumber")
  .max(accountLimits.phone, "validation.maximum20Characters")
  .regex(/^\+?[0-9 ().-]+$/, "validation.useNumbersSpaces")
  .transform((v, ctx) => {
    const parsed = parsePhoneNumberFromString(v, defaultPhoneCountry);
    if (parsed?.isValid()) return parsed.number as string;
    ctx.addIssue({ code: "custom", message: "validation.enterValidPhoneNumber" });
    return z.NEVER;
  });
const optionalEmail = z
  .union([email, z.literal("")])
  .optional()
  .default("");
/** Teléfono opcional: vacío o un teléfono válido. Sin `z.union`, que taparía el motivo del error. */
const optionalPhone = z
  .string()
  .optional()
  .default("")
  .transform((v, ctx) => {
    if (v.trim() === "") return "";
    const result = phone.safeParse(v);
    if (result.success) return result.data;
    for (const issue of result.error.issues) ctx.addIssue({ ...issue, path: issue.path } as z.core.$ZodRawIssue);
    return z.NEVER;
  });
/** Espacios del principio y del final fuera, y los repetidos juntos (§6.2). */
const text = () =>
  z
    .string()
    .trim()
    .overwrite((v) => v.replace(/\s+/g, " "));
const name = text()
  .min(2, "validation.enterLeast2Characters")
  .max(100, "validation.maximum100Characters");
/** Nombres y apellidos de personas (§6.2): letras de cualquier idioma, espacios, apóstrofo, punto y guion. */
const personName = text()
  .min(2, "validation.enterLeast2Characters")
  .max(accountLimits.personName, "validation.maximum50Characters")
  .regex(
    /^[\p{L}\p{M}](?:[\p{L}\p{M} '’.-]*[\p{L}\p{M}.])?$/u,
    "validation.useLettersSpaces",
  );
/** Contraseña: la misma regla al crear cuenta, al entrar y al restablecerla. */
const password = z
  .string()
  .min(10, "validation.useLeast10Characters")
  .max(accountLimits.password, "validation.maximum128Characters");
/** Tipo de cuenta, fijo desde el registro: organiza eventos u ofrece servicios para ellos. */
export const accountTypes = ["organizer", "provider"] as const;
export type AccountType = (typeof accountTypes)[number];
const accountType = z.enum(accountTypes, "validation.invalidAccountType");
export const registerSchema = z.strictObject({
  firstName: personName,
  lastName: personName,
  email,
  phone,
  password,
  // Las apps anteriores no lo envían: organizan eventos
  accountType: accountType.default("organizer"),
});
/** Acceso con Google; el tipo solo cuenta si la cuenta se crea en ese momento. */
export const googleLoginSchema = z.strictObject({
  credential: z.string().max(12000),
  nonce: z.string().min(20).max(100),
  accountType: accountType.optional(),
});
export const loginSchema = z.strictObject({
  email,
  password,
});
export const profileSchema = z.strictObject({
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
export const forgotPasswordSchema = z.strictObject({ email });
export const resetPasswordSchema = z.strictObject({
  token: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/, "common.passwordResetLinkInvalid"),
  password,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export const newsletterSchema = z.strictObject({
  email,
  name: z.string().trim().max(100).optional(),
});
export type NewsletterInput = z.infer<typeof newsletterSchema>;
export const eventSchema = z.strictObject({
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
  /** Punto exacto del lugar: undefined lo conserva, null lo quita. */
  geo: geoPointSchema.nullable().optional(),
  theme: z.enum(themeIds),
  archived: z.boolean().default(false),
  /** Evento cancelado: sigue visible con aviso, y se avisa a los invitados. */
  cancelled: z.boolean().default(false),
  /** Contraseña para ver la página pública: undefined la conserva, "" la quita. */
  publicPassword: z
    .string()
    .max(accountLimits.password, "validation.maximum128Characters")
    .optional(),
  /** Dirección de la landing (/<código>/<dirección>); vacía, la API la crea a partir del título. */
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(accountLimits.eventSlug, "validation.maximum60Characters")
    .refine(
      (v) => v === "" || (v.length >= 3 && eventSlugPattern.test(v)),
      "validation.eventSlugFormat",
    )
    .default(""),
});
export const memberSchema = z.strictObject({
  id: z.uuid().optional(),
  name,
  kind: z.enum(["adult", "child"]),
  notes: z.string().trim().max(500).default(""),
});
/** Límites de la invitación genérica: registros por enlace y personas por registro. */
export const openInvitationLimits = { registrations: 200, members: 20 } as const;
const invitationFields = z.strictObject({
  name: z.string().trim().max(120).default(""),
  email: optionalEmail,
  phone: optionalPhone,
  notes: z.string().trim().max(1000).default(""),
  kind: z.enum(["individual", "family", "open"]),
  members: z.array(memberSchema).max(50),
});
type InvitationFields = z.infer<typeof invitationFields>;
/** Reglas comunes: hace falta un nombre o contacto, y un individual lleva exactamente una persona. */
function checkInvitation(v: InvitationFields, ctx: z.RefinementCtx) {
  if (!v.name && !v.email && !v.phone)
    ctx.addIssue({ code: "custom", path: ["name"], message: "validation.enterNamePhoneNumber" });
  if (v.kind === "individual" && v.members.length !== 1)
    ctx.addIssue({ code: "custom", path: ["members"], message: "validation.individualInvitationMustHave" });
  const ids = v.members.map((m) => m.id).filter(Boolean);
  if (new Set(ids).size !== ids.length)
    ctx.addIssue({ code: "custom", path: ["members"], message: "validation.thereDuplicateMembers" });
}
/** Invitación del organizador: personalizada (con personas) o genérica (sin personas; las pone cada invitado). */
export const invitationSchema = invitationFields.superRefine((v, ctx) => {
  checkInvitation(v, ctx);
  if (v.kind !== "open" && v.members.length === 0)
    ctx.addIssue({ code: "custom", path: ["members"], message: "validation.addLeastOnePerson" });
  if (v.kind === "open" && v.members.length > 0)
    ctx.addIssue({ code: "custom", path: ["members"], message: "validation.openInvitationNoMembers" });
});
/** Lo que entrega el invitado en una invitación genérica: sus propias personas y estados. */
export const registrationSchema = invitationFields
  .extend({
    kind: z.enum(["individual", "family"]),
    members: z
      .array(memberSchema.extend({ status: statusSchema.default("pending") }))
      .min(1, "validation.addLeastOnePerson")
      .max(openInvitationLimits.members),
  })
  .superRefine(checkInvitation);
export const rsvpSchema = z
  .object({
    members: z
      .array(z.strictObject({ id: z.uuid(), status: statusSchema }))
      .min(1)
      .max(50),
  })
  .refine(
    (v) => new Set(v.members.map((m) => m.id)).size === v.members.length,
    "validation.thereDuplicateMembers",
  );
export type EventInput = z.infer<typeof eventSchema>;
export type InvitationInput = z.infer<typeof invitationSchema>;
export type RegistrationInput = z.infer<typeof registrationSchema>;
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
  /** Código público de la cuenta, primera parte de la URL de sus landings. */
  publicCode: string;
  accountType: AccountType;
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
export type Event = Omit<EventInput, "publicPassword" | "geo"> & {
  geo: GeoPoint | null;
  id: string;
  createdAt: string;
  metrics: Metrics;
  /** Si la página pública pide contraseña (la contraseña nunca se devuelve). */
  hasPublicPassword: boolean;
};
/** Evento visto desde su landing: sin invitados ni respuestas. */
export type PublicEvent = {
  title: string;
  cancelled: boolean;
  description: string;
  date: string;
  timeZone: string;
  location: string;
  geo: GeoPoint | null;
  theme: EventInput["theme"];
  host: Pick<User, "firstName" | "lastName" | "avatar">;
  /** Postal del evento, o la plantilla de su tema si el organizador no la ha editado. */
  postcard: Pick<Postcard, "design" | "photos">;
};
/**
 * Landing de un evento según quién la abre: un invitado que entró con su enlace personal (el token
 * de su invitación, para ver la postal y responder), el organizador (con el enlace a su panel), alguien que acertó la contraseña,
 * o `locked` si el evento tiene contraseña y aún no hay acceso. Sin acceso ni contraseña, 404.
 */
export type EventLanding =
  | { access: "owner"; eventId: string; event: PublicEvent }
  /** `eventId`, solo si quien abre el enlace personal es el propio organizador. */
  | { access: "guest"; token: string; eventId?: string }
  | { access: "password"; event: PublicEvent }
  | { access: "locked" };
/** Landing a la que lleva un enlace personal: el acceso del invitado viaja en una cookie. */
export type LandingAddress = { code: string; slug: string };
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
  kind: "individual" | "family" | "open";
  token: string;
  /** Invitación genérica de la que nace este registro, si lo hay. */
  parentId: string | null;
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
  kind: "individual" | "family" | "open";
  event: Pick<
    Event,
    "title" | "description" | "date" | "timeZone" | "location" | "geo" | "theme" | "cancelled"
  >;
  /** Solo en genéricas: ya hay tantos registros como permite el enlace. */
  registrationsFull: boolean;
  host: Pick<User, "firstName" | "lastName" | "avatar">;
  members: Pick<Member, "id" | "name" | "kind" | "status">[];
  /** Postal del evento, o la plantilla de su tema si el organizador no la ha editado. */
  postcard: Pick<Postcard, "design" | "photos">;
  isDemo: boolean;
};
/**
 * Lo que se puede volver a enviar de un evento o una invitación que devolvió la API: la API
 * rechaza los campos de solo lectura (id, métricas, estado de cada persona…).
 */
export const eventInput = (e: Event): EventInput => ({
  title: e.title,
  description: e.description,
  date: e.date,
  timeZone: e.timeZone,
  location: e.location,
  geo: e.geo,
  theme: e.theme,
  archived: e.archived,
  cancelled: e.cancelled,
  slug: e.slug,
});
export const invitationInput = (i: Invitation): InvitationInput => ({
  name: i.name,
  email: i.email,
  phone: i.phone,
  notes: i.notes,
  kind: i.kind,
  members: i.members.map((m) => ({ id: m.id, name: m.name, kind: m.kind, notes: m.notes })),
});
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
export * from "./calendar";
export * from "./geo";
export * from "./pricing";
export * from "./problems";

export const clientPlatformSchema = z.enum(["web", "android", "ios"]);
export type ClientPlatform = z.infer<typeof clientPlatformSchema>;
export const visitSchema = z.strictObject({ visitorId: z.uuid(), route: z.enum(["landing", "downloads", "app"]), visitId: z.uuid() });
export const releaseSchema = z.strictObject({
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

/** Postal de cada evento: lienzo vertical 3:4; posiciones y tamaños en porcentaje del lienzo. */
export const postcardLimits = {
  photos: 2,
  texts: 3,
  photoBytes: 2 * 1024 * 1024,
  photoSide: 2048,
  versions: 20,
} as const;
export const postcardFonts = ["manrope", "bricolage", "playfair", "pacifico"] as const;
export const postcardAligns = ["left", "center", "right"] as const;
export type PostcardFont = (typeof postcardFonts)[number];
const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, "validation.useHexColor");
const postcardBackground = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("template"), theme: z.enum(themeIds) }),
  z.strictObject({ type: z.literal("color"), color: hexColor }),
  z.strictObject({ type: z.literal("photo"), photo: z.uuid() }),
]);
const postcardPhoto = z.strictObject({
  photo: z.uuid(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(1).max(100),
  height: z.number().min(1).max(100),
});
/** Sombra detrás de un texto. Todas las medidas van en cqw (porcentaje del ancho de la postal). */
export const postcardShadowLimits = { blur: 10, offset: 5 } as const;
const postcardShadow = z.strictObject({
  color: hexColor,
  blur: z.number().min(0).max(postcardShadowLimits.blur),
  x: z.number().min(-postcardShadowLimits.offset).max(postcardShadowLimits.offset),
  y: z.number().min(-postcardShadowLimits.offset).max(postcardShadowLimits.offset),
});
const postcardText = z.strictObject({
  content: z
    .string()
    .trim()
    .min(1)
    .max(accountLimits.postcardText, "validation.maximum200Characters"),
  font: z.enum(postcardFonts),
  /** Tamaño de letra en píxeles sobre un lienzo de 1000 px de ancho. */
  size: z.number().min(12).max(160),
  color: hexColor,
  align: z.enum(postcardAligns),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(5).max(100),
  /** Ausente en los diseños anteriores: el texto no tiene sombra. */
  shadow: postcardShadow.optional(),
});
export const postcardSchema = z.strictObject({
  background: postcardBackground,
  photos: z.array(postcardPhoto).max(postcardLimits.photos),
  texts: z.array(postcardText).max(postcardLimits.texts),
});
export type PostcardDesign = z.infer<typeof postcardSchema>;
export const emptyPostcard: PostcardDesign = {
  background: { type: "color", color: "#ffffff" },
  photos: [],
  texts: [],
};
/** Postal de un evento tal como la lee el editor: diseño, fecha y fotos subidas. */
export type Postcard = {
  design: PostcardDesign;
  updatedAt: string | null;
  photos: { id: string; url: string }[];
};
export type PostcardVersion = { id: string; createdAt: string };
