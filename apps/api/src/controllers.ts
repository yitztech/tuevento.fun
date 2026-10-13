import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Req,
  Res,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
  Sse,
  ConflictException,
} from "@nestjs/common";
import { z } from "zod";
import sharp from "sharp";
import { randomBytes } from "node:crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import {
  normalizeLocale,
  translateMessage,
  notificationMessage,
  registerSchema,
  loginSchema,
  eventSchema,
  invitationSchema,
  rsvpSchema,
  profileSchema,
} from "@tuevento/contracts";
import {
  AuthService,
  SessionGuard,
  userView,
  type AuthedRequest,
} from "./auth";
import { Database } from "./database";
import { DemoService } from "./demo";
import { EventsService, Updates } from "./events";
function parse<T extends z.ZodType>(
  schema: T,
  body: unknown,
  req?: FastifyRequest,
): z.output<T> {
  const locale = normalizeLocale(req?.headers["accept-language"]);
  const result = schema.safeParse(body, {
    error: z.locales[locale]().localeError,
  });
  if (!result.success)
    throw new BadRequestException({
      message: result.error.issues[0]?.message || "Revisa los datos.",
      fields: z.flattenError(result.error).fieldErrors,
    });
  return result.data;
}
@Controller()
export class PublicController {
  constructor(
    private db: Database,
    private auth: AuthService,
    private demo: DemoService,
    private events: EventsService,
  ) {}
  @Get("health") async health() {
    await this.db.query("SELECT 1");
    return { status: "ok", database: "connected" };
  }
  @Get("config") config() {
    return {
      googleClientId: process.env.GOOGLE_CLIENT_ID || "",
      demoEnabled: process.env.DEMO_ENABLED === "true",
    };
  }
  @Post("auth/register") async register(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.auth.session(
      await this.auth.register(parse(registerSchema, body, req)),
      req,
      reply,
      "registration",
    );
  }
  @Post("auth/login") async login(
    @Body() body: unknown,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const data = parse(loginSchema, body, req);
    return this.auth.session(
      await this.auth.login(data.email, data.password),
      req,
      reply,
    );
  }
  @Post("auth/demo") async demoLogin(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.auth.session(await this.demo.create(), req, reply);
  }
  @Post("auth/google/nonce") googleNonce(
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const nonce = randomBytes(24).toString("base64url");
    reply.setCookie("google_nonce", nonce, {
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
    const data = parse(
      z.object({
        credential: z.string().max(12000),
        nonce: z.string().min(20).max(100),
      }),
      body,
      req,
    );
    return this.auth.session(
      await this.auth.google(data.credential, data.nonce, req, reply),
      req,
      reply,
    );
  }
  @Get("auth/me") me(@Req() req: FastifyRequest) {
    return this.auth.current(req);
  }
  @Post("auth/logout") logout(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.auth.logout(req, reply);
  }
  @Get("invitations/:token") invitation(@Param("token") token: string) {
    return this.events.publicInvitation(this.token(token));
  }
  @Post("invitations/:token/rsvp") rsvp(
    @Req() req: FastifyRequest,
    @Param("token") token: string,
    @Body() body: unknown,
  ) {
    return this.events.rsvp(
      this.token(token),
      parse(rsvpSchema, body, req).members,
    );
  }
  private token(token: string) {
    return parse(
      z.string().regex(/^[\w-]{32}$/, "El enlace de invitación no es válido."),
      token,
    );
  }
}
@Controller()
@UseGuards(SessionGuard)
export class OrganizerController {
  constructor(
    private db: Database,
    private events: EventsService,
    private updates: Updates,
  ) {}
  @Sse("stream") stream(@Req() req: AuthedRequest) {
    return this.updates.stream(req.user.id);
  }
  @Get("events") list(@Req() req: AuthedRequest) {
    return this.events.list(req.user.id);
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
      parse(eventSchema, body, req),
      id,
    );
  }
  @Delete("events/:id") remove(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.events.removeEvent(req.user.id, id);
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
            normalizeLocale(req.headers["accept-language"]),
          )
        : this.legacyNotification(
            r.message,
            normalizeLocale(req.headers["accept-language"]),
          ),
      read: r.read,
      createdAt: r.created_at.toISOString(),
    }));
  }
  private legacyNotification(message: string, locale: "es" | "en") {
    if (locale === "es") return message;
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
      return `${demo[1]} ${demo[1] === "1" ? "person confirmed" : "people confirmed"} attendance.`;
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
  @Patch("profile") async profile(
    @Req() req: AuthedRequest,
    @Body() body: unknown,
  ) {
    const d = parse(profileSchema, body, req);
    try {
      const [r] = await this.db.query(
        "UPDATE users SET first_name=$1,last_name=$2,phone=$3,username=$4 WHERE id=$5 RETURNING *",
        [d.firstName, d.lastName, d.phone, d.username, req.user.id],
      );
      return userView(r);
    } catch (e: any) {
      if (e.code === "23505")
        throw new ConflictException("Este nombre de usuario ya está en uso.");
      throw e;
    }
  }
  @Put("profile/avatar") async avatar(
    @Req() req: AuthedRequest,
    @Body() body: unknown,
  ) {
    const data = parse(
      z.object({
        dataUrl: z
          .string()
          .max(2800000)
          .regex(
            /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/,
            "Usa una imagen PNG, JPG o WebP de hasta 2 MB.",
          ),
      }),
      body,
      req,
    );
    const bytes = Buffer.from(data.dataUrl.split(",")[1], "base64");
    if (bytes.length > 2 * 1024 * 1024)
      throw new BadRequestException("La imagen debe pesar menos de 2 MB.");
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
      throw new BadRequestException(
        "No se pudo leer la imagen. Prueba con otra.",
      );
    }
    const [r] = await this.db.query(
      "UPDATE users SET avatar=$1 WHERE id=$2 RETURNING *",
      [avatar, req.user.id],
    );
    return userView(r);
  }
}
