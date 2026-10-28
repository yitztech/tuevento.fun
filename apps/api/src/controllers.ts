import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Req,
  Res,
  Query,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
  ForbiddenException,
  UnprocessableEntityException,
  Sse,
} from "@nestjs/common";
import { z } from "zod";
import sharp from "sharp";
import { randomBytes } from "node:crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import {
  translate,
  translateMessage,
  notificationMessage,
  type Locale,
  registerSchema,
  googleLoginSchema,
  loginSchema,
  eventSchema,
  invitationSchema,
  rsvpSchema,
  profileSchema,
  newsletterSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  postcardSchema,
  registrationSchema,
  unsubscribeSchema,
  verifyEmailSchema,
  checkoutSchema,
  localePrefix,
  type TierIndex,
  eventSlugPattern,
  accountLimits,
} from "@tuevento/contracts";
import {
  AuthService,
  GOOGLE_NONCE_COOKIE,
  SessionGuard,
  AccountTypeGuard,
  RequireAccountType,
  userView,
  type AuthedRequest,
} from "./auth";
import { Database } from "./database";
import { DemoService } from "./demo";
import { EventsService, Updates } from "./events";
import { ListmonkService } from "./listmonk";
import { NoticeService } from "./notices";
import { PaymentsService } from "./payments";
import { paymentsEnabled } from "./payment-config";
import { PostcardsService } from "./postcards";
import { siteUrl } from "./locale-env";
import { requestLocale } from "./request-locale";
import { parse } from "./problem";
import { ipKey, limits } from "./rate-limit";
@Controller()
export class PublicController {
  constructor(
    private db: Database,
    private auth: AuthService,
    private demo: DemoService,
    private events: EventsService,
    private listmonk: ListmonkService,
    private postcards: PostcardsService,
    private notices: NoticeService,
    private payments: PaymentsService,
  ) {}
  @Post("newsletter/subscribe") async subscribeNewsletter(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
  ) {
    const data = parse(newsletterSchema, body, req);
    limits.newsletterIp.hit(ipKey("newsletter", req));
    limits.newsletterEmail.hit(`newsletter:email:${data.email}`);
    return this.listmonk.subscribe(data.email, data.name, requestLocale(req));
  }
  @Get("postcards/images/:id") async postcardImage(
    @Param("id", ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    // Las cabeceras de imagen solo se fijan si la foto existe: un error se responde como JSON
    const bytes = await this.postcards.image(id);
    reply.header("Cache-Control", "public, max-age=31536000, immutable");
    reply.type("image/jpeg");
    return bytes;
  }
  /** Salud para Uptime Kuma (§20): solo el estado, 503 si la base de datos no responde. */
  @Get("health") async health(@Res({ passthrough: true }) reply: FastifyReply) {
    try {
      await this.db.query("SELECT 1");
      return { status: "ok" };
    } catch {
      reply.status(503);
      return { status: "error" };
    }
  }
  @Get("config") config() {
    return {
      googleClientId: process.env.GOOGLE_CLIENT_ID || "",
      demoEnabled: process.env.DEMO_ENABLED === "true",
      paymentsEnabled: paymentsEnabled(),
    };
  }
  @Post("auth/register") async register(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const data = parse(registerSchema, body, req);
    limits.register.hit(ipKey("register", req));
    const user = await this.auth.session(
      await this.auth.register(data, requestLocale(req)),
      req,
      reply,
      "registration",
    );
    await this.auth.sendEmailVerification(user, requestLocale(req));
    return user;
  }
  @Post("auth/login") async login(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const data = parse(loginSchema, body, req);
    return this.auth.session(
      await this.auth.login(data.email, data.password, req),
      req,
      reply,
    );
  }
  @Post("auth/password/forgot") forgotPassword(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
  ) {
    return this.auth.requestPasswordReset(
      parse(forgotPasswordSchema, body, req).email,
      req,
    );
  }
  @Post("auth/password/reset") async resetPassword(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const data = parse(resetPasswordSchema, body, req);
    return this.auth.session(
      await this.auth.resetPassword(data.token, data.password),
      req,
      reply,
    );
  }
  // Solo una cuenta registrada puede abrir una demostración, también por la API
  @Post("auth/demo") async demoLogin(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const user = await this.auth.current(req);
    if (user.isDemo) throw new ForbiddenException();
    return this.auth.session(await this.demo.create(requestLocale(req)), req, reply);
  }
  @Post("auth/google/nonce") googleNonce(
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const nonce = randomBytes(24).toString("base64url");
    reply.setCookie(GOOGLE_NONCE_COOKIE, nonce, {
      ...this.auth.cookieOptions(),
      maxAge: 300,
    });
    return { nonce };
  }
  @Post("auth/google") async google(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const data = parse(googleLoginSchema, body, req);
    return this.auth.session(
      await this.auth.google(data.credential, data.nonce, req, reply, data.accountType),
      req,
      reply,
    );
  }
  @Get("auth/me") me(@Req() req: FastifyRequest) {
    return this.auth.current(req);
  }
  /** Confirmar el correo desde el enlace del correo; no hace falta tener la sesión abierta. */
  @Post("auth/email/verify") @HttpCode(200) verifyEmail(@Body() body: unknown, @Req() req: FastifyRequest) {
    limits.publicForm.hit(ipKey("public-form", req));
    return this.auth.verifyEmail(parse(verifyEmailSchema, body, req).token);
  }
  @Post("auth/email/resend") @HttpCode(200) async resendVerification(@Req() req: FastifyRequest) {
    return this.auth.resendEmailVerification(await this.auth.current(req), req);
  }
  /**
   * Baja de los avisos a invitados. Llega desde la página del enlace (JSON) o, en un clic, desde
   * el gestor de correo (RFC 8058: POST con `List-Unsubscribe=One-Click` y los datos en la URL).
   */
  @Post("mail/unsubscribe") @HttpCode(200) async unsubscribe(
    @Req() req: FastifyRequest,
    @Query() query: Record<string, unknown>,
    @Body() body: unknown,
  ) {
    limits.publicForm.hit(ipKey("public-form", req));
    const input = body && typeof body === "object" && "h" in body ? body : { h: query.h, s: query.s };
    const { h, s } = parse(unsubscribeSchema, input, req);
    if (!(await this.notices.unsubscribe(h, s))) throw new BadRequestException("errors.unsubscribeLinkInvalid");
    return { ok: true };
  }
  /** Webhook de Stripe (sin sesión ni Origin): solo cuenta si la firma es válida. */
  @Post("payments/webhook") @HttpCode(200) paymentWebhook(@Req() req: FastifyRequest & { rawBody?: Buffer }) {
    const signature = req.headers["stripe-signature"];
    return this.payments.webhook(req.rawBody?.toString("utf8"), typeof signature === "string" ? signature : undefined);
  }
  @Post("auth/logout") logout(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.auth.logout(req, reply);
  }
  @Get("invitations/:token") invitation(
    @Req() req: FastifyRequest,
    @Param("token") token: string,
  ) {
    return this.events.publicInvitation(this.token(token, req));
  }
  /** Las direcciones /e/<dirección> de antes de la landing: a qué landing llevan. */
  @Get("public/events/:slug") legacyEventAddress(@Param("slug") slug: string) {
    return this.events.legacyAddress(slug);
  }
  /** Enlace personal: deja al invitado una cookie de acceso a la landing y dice cuál es. */
  @Post("invitations/:token/access")
  @HttpCode(200)
  async invitationAccess(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Param("token") token: string,
  ) {
    limits.landingAccessIp.hit(ipKey("landing-access", req));
    const { code, slug, eventId, access, seconds } = await this.events.invitationAccess(this.token(token, req));
    setLandingAccess(reply, eventId, access, seconds);
    return { code, slug };
  }
  @Get("public/landing/:code/:slug") async landing(
    @Req() req: FastifyRequest,
    @Param("code") code: string,
    @Param("slug") slug: string,
  ) {
    const viewer = await this.auth.current(req).catch(() => null);
    return this.events.landing(code, slug, viewer?.id ?? null, landingAccess(req));
  }
  /** Contraseña del evento: al acertarla se entrega una cookie de acceso de 1 día. */
  @Post("public/landing/:code/:slug/unlock")
  @HttpCode(200)
  async unlockLanding(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Param("code") code: string,
    @Param("slug") slug: string,
    @Body() body: unknown,
  ) {
    const { password } = parse(
      z.strictObject({ password: z.string().min(1).max(accountLimits.password) }),
      body,
      req,
    );
    limits.unlockIp.hit(ipKey("unlock", req));
    const granted = await this.events.unlockLanding(code, slug, password, req.ip);
    if (granted) setLandingAccess(reply, granted.eventId, granted.token, 86400);
    return { ok: true };
  }
  @Get("public/landing/:code/:slug/calendar.ics") async landingCalendar(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Param("code") code: string,
    @Param("slug") slug: string,
  ) {
    const viewer = await this.auth.current(req).catch(() => null);
    const ics = await this.events.calendarForLanding(code, slug, viewer?.id ?? null, landingAccess(req), requestLocale(req));
    return calendarResponse(reply, ics);
  }
  @Get("invitations/:token/calendar.ics") async invitationCalendar(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Param("token") token: string,
  ) {
    const ics = await this.events.calendarForInvitation(this.token(token, req), requestLocale(req));
    return calendarResponse(reply, ics);
  }
  /** Invitado de una invitación genérica: entrega sus datos y personas, y recibe su propia invitación. */
  @Post("invitations/:token/register") registerGuest(
    @Req() req: FastifyRequest,
    @Param("token") token: string,
    @Body() body: unknown,
  ) {
    const invitation = this.token(token, req);
    const data = parse(registrationSchema, body, req);
    limits.publicForm.hit(ipKey("public-form", req));
    return this.events.register(invitation, data);
  }
  @Post("invitations/:token/rsvp") rsvp(
    @Req() req: FastifyRequest,
    @Param("token") token: string,
    @Body() body: unknown,
  ) {
    const invitation = this.token(token, req);
    const { members } = parse(rsvpSchema, body, req);
    limits.publicForm.hit(ipKey("public-form", req));
    return this.events.rsvp(invitation, members);
  }
  private token(token: string, req: FastifyRequest) {
    return parse(
      z.string().regex(/^[\w-]{32}$/, "errors.invitationLinkInvalid"),
      token,
      req,
      400,
    );
  }
}
@Controller()
@UseGuards(SessionGuard, AccountTypeGuard)
@RequireAccountType("organizer")
export class OrganizerController {
  constructor(
    private db: Database,
    private events: EventsService,
    private updates: Updates,
    private postcards: PostcardsService,
    private payments: PaymentsService,
  ) {}
  @Sse("stream") stream(@Req() req: AuthedRequest) {
    return this.updates.stream(req.user.id);
  }
  @Get("events") list(@Req() req: AuthedRequest) {
    return this.events.list(req.user.id);
  }
  @Get("events/slug-available") slugAvailable(
    @Req() req: AuthedRequest,
    @Query() query: unknown,
  ) {
    const { slug, eventId } = parse(
      z.strictObject({
        slug: z.string().trim().toLowerCase().max(accountLimits.eventSlug),
        eventId: z.uuid().optional(),
      }),
      query,
      req,
      400,
    );
    if (!eventSlugPattern.test(slug)) return { available: false };
    return this.events.slugAvailable(req.user.id, slug, eventId);
  }
  @Get("events/:id") event(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.events.event(req.user.id, id);
  }
  @Post("events") create(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.events.saveEvent(req.user.id, parse(eventSchema, body, req));
  }
  @Patch("events/:id") update(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.events.saveEvent(
      req.user.id,
      parse(eventSchema, withoutEventOutput(body), req),
      id,
    );
  }
  @Post("events/:id/checkout") @HttpCode(200) checkout(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    limits.checkout.hit(req.user.id);
    const { tier } = parse(checkoutSchema, body, req);
    const locale = requestLocale(req);
    return this.payments.checkout(req.user.id, id, tier as TierIndex, locale, returnSite(req, locale));
  }
  @Delete("events/:id") remove(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.events.removeEvent(req.user.id, id);
  }
  @Get("events/:id/postcard") postcard(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.postcards.get(req.user.id, id);
  }
  @Put("events/:id/postcard") savePostcard(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.postcards.save(req.user.id, id, parse(postcardSchema, body, req));
  }
  @Get("events/:id/postcard/versions") postcardVersions(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.postcards.versions(req.user.id, id);
  }
  @Post("events/:id/postcard/versions/:versionId/restore") restorePostcard(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("versionId", ParseUUIDPipe) versionId: string,
  ) {
    return this.postcards.restore(req.user.id, id, versionId);
  }
  @Post("events/:id/postcard/images") uploadPostcardImage(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    const data = parse(
      z.strictObject({
        dataUrl: z
          .string()
          .max(2800000)
          .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "errors.usePngJpgWebp"),
      }),
      body,
      req,
    );
    return this.postcards.uploadImage(req.user.id, id, data.dataUrl);
  }
  @Delete("events/:id/postcard/images/:imageId") removePostcardImage(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("imageId", ParseUUIDPipe) imageId: string,
  ) {
    return this.postcards.removeImage(req.user.id, id, imageId);
  }
  @Get("events/:id/invitations") invitations(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.events.invitations(req.user.id, id);
  }
  @Post("events/:id/invitations") invite(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.events.saveInvitation(
      req.user.id,
      id,
      parse(invitationSchema, body, req),
    );
  }
  @Put("events/:id/invitations/:invitationId") updateInvite(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("invitationId", ParseUUIDPipe) invitationId: string,
    @Body() body: unknown,
  ) {
    return this.events.saveInvitation(
      req.user.id,
      id,
      parse(invitationSchema, body, req),
      invitationId,
    );
  }
  @Delete("events/:id/invitations/:invitationId") removeInvite(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("invitationId", ParseUUIDPipe) invitationId: string,
  ) {
    return this.events.removeInvitation(req.user.id, id, invitationId);
  }
  @Get("notifications") async notifications(@Req() req: AuthedRequest) {
    const rows = await this.db.query(
      "SELECT n.*,e.title FROM notifications n JOIN events e ON e.id=n.event_id WHERE n.user_id=$1 ORDER BY n.created_at DESC LIMIT 100",
      [req.user.id],
    );
    return rows.map((r) => ({
      id: r.id,
      eventId: r.event_id,
      eventTitle: r.title,
      guestName: r.guest_name,
      message: r.counts
        ? notificationMessage(
            r.counts,
            requestLocale(req),
          )
        : this.legacyNotification(
            r.message,
            requestLocale(req),
          ),
      read: r.read,
      createdAt: r.created_at.toISOString(),
    }));
  }
  /** Notificaciones guardadas antes de `counts`: solo tienen el texto en español. */
  private legacyNotification(message: string, locale: Locale) {
    const reply = message.match(
      /^(\d+) confirmad[oa]s?, (\d+) no asistir[aá]n? y (\d+) en espera\.$/,
    );
    if (reply)
      return notificationMessage(
        {
          accepted: Number(reply[1]),
          declined: Number(reply[2]),
          pending: Number(reply[3]),
        },
        locale,
      );
    const demo = message.match(/^(\d+) persona/);
    if (demo)
      return translate(locale, "notifications.demoConfirmed", { count: Number(demo[1]) });
    return translateMessage(message, locale);
  }
  @Post("notifications/read") async read(@Req() req: AuthedRequest) {
    await this.db.query(
      "UPDATE notifications SET read=true WHERE user_id=$1 AND read=false",
      [req.user.id],
    );
    this.updates.emit(req.user.id);
    return { ok: true };
  }
}

/** Perfil de la cuenta: igual para quien organiza eventos y para quien ofrece servicios. */
@Controller()
@UseGuards(SessionGuard)
export class AccountController {
  constructor(private db: Database) {}
  @Patch("profile") async profile(
    @Req() req: AuthedRequest,
    @Body() body: unknown,
  ) {
    const d = parse(profileSchema, body, req);
    const [r] = await this.db.query(
      "UPDATE users SET first_name=$1,last_name=$2,phone=$3 WHERE id=$4 RETURNING *",
      [d.firstName, d.lastName, d.phone, req.user.id],
    );
    return userView(r);
  }
  @Put("profile/avatar") async avatar(
    @Req() req: AuthedRequest,
    @Body() body: unknown,
  ) {
    const data = parse(
      z.strictObject({
        dataUrl: z
          .string()
          .max(2800000)
          .regex(
            /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/,
            "errors.usePngJpgWebp",
          ),
      }),
      body,
      req,
    );
    const bytes = Buffer.from(data.dataUrl.split(",")[1], "base64");
    if (bytes.length > 2 * 1024 * 1024)
      throw new UnprocessableEntityException("errors.imageMustSmallerThan");
    let avatar: string;
    try {
      const image = sharp(bytes, { limitInputPixels: 25000000 });
      const metadata = await image.metadata();
      if (!["jpeg", "png", "webp"].includes(metadata.format || ""))
        throw new Error("Unsupported image");
      const result = await image
        .rotate()
        .resize(256, 256, { fit: "cover" })
        .jpeg({ quality: 85 })
        .toBuffer();
      avatar = `data:image/jpeg;base64,${result.toString("base64")}`;
    } catch {
      throw new UnprocessableEntityException(
        "errors.couldntReadImageTry",
      );
    }
    const [r] = await this.db.query(
      "UPDATE users SET avatar=$1 WHERE id=$2 RETURNING *",
      [avatar, req.user.id],
    );
    return userView(r);
  }
}

/**
 * Acceso a la landing (de un invitado o por la contraseña): una cookie por evento, solo para las
 * rutas de la landing en la API. El valor es un token aleatorio; la base de datos guarda su hash.
 */
const landingCookie = (eventId: string) => `landing_${eventId}`;
const LANDING_COOKIE_PATH = "/api/public/landing";
const landingAccess = (req: FastifyRequest) => (eventId: string) => req.cookies?.[landingCookie(eventId)];
function setLandingAccess(reply: FastifyReply, eventId: string, token: string, maxAge: number) {
  reply.setCookie(landingCookie(eventId), token, {
    path: LANDING_COOKIE_PATH,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    maxAge,
  });
}
/** Archivo de calendario descargable (.ics). */
function calendarResponse(reply: FastifyReply, ics: string) {
  reply.header("Content-Type", "text/calendar; charset=utf-8");
  reply.header("Content-Disposition", 'attachment; filename="evento.ics"');
  reply.header("Cache-Control", "no-store");
  return ics;
}

/**
 * Las versiones publicadas de la app archivan un evento reenviando el evento completo, con los
 * campos de solo lectura que devuelve la API. Se quitan esos (y solo esos) antes de validar; el
 * resto de campos desconocidos se rechaza.
 */
/**
 * Sitio al que vuelve el navegador desde Stripe: el origen desde el que se abrió el pago si es uno
 * de los permitidos (ALLOWED_ORIGINS, el mismo control que el CSRF), para conservar su sesión; si
 * no, el SITE_URL del idioma (§20). Con el prefijo del idioma (/pt…) en los dos casos.
 */
function returnSite(req: FastifyRequest, locale: Locale) {
  const site = siteUrl(locale);
  const origin = req.headers.origin;
  const allowed = (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean);
  if (typeof origin !== "string" || !allowed.includes(origin)) return site;
  return `${origin}${localePrefix(locale)}`;
}
function withoutEventOutput(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const {
    id: _id,
    createdAt: _createdAt,
    metrics: _metrics,
    hasPublicPassword: _hasPublicPassword,
    passwordFailures: _passwordFailures,
    paidTier: _paidTier,
    ...input
  } = body as Record<string, unknown>;
  return input;
}
