import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ServiceUnavailableException,
  BadRequestException,
  HttpException,
  HttpStatus,
  CanActivate,
  ExecutionContext,
  Logger,
} from "@nestjs/common";
import {
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { OAuth2Client } from "google-auth-library";
import type { FastifyRequest, FastifyReply } from "fastify";
import { clientPlatform } from "./client-platform";
import { Database } from "./database";
import {
  passwordResetPaths,
  PASSWORD_RESET_MINUTES,
  normalizeLocale,
  translate,
  type Locale,
  type RegisterInput,
  type User,
} from "@tuevento/contracts";
import { requestLocale } from "./request-locale";
import { MailService } from "./mail";
import { passwordChangedMail, passwordResetMail } from "./mail-templates";
import { siteUrl } from "./locale-env";
const scrypt = promisify(scryptCallback);
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
// Freno a la fuerza bruta de contraseñas, por cuenta y no por IP: así no afecta a
// oficinas tras NAT ni a las pruebas, pero detiene el adivinado contra un correo.
const LOGIN_MAX_FAILURES = 5,
  LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginFailures = new Map<string, { count: number; reset: number }>();
// Peticiones de recuperación de contraseña: por IP (frena el abuso del formulario)
// y por correo (no inunda un buzón). Pasado el límite por correo se responde igual,
// sin enviar nada, para no revelar si la cuenta existe.
const RESET_WINDOW_MS = 15 * 60 * 1000,
  RESET_MAX_PER_IP = 10,
  RESET_MAX_PER_EMAIL = 3;
const resetRequests = new Map<string, { count: number; reset: number }>();
function allow(key: string, max: number, now = Date.now()) {
  if (resetRequests.size > 10_000)
    for (const [k, entry] of resetRequests)
      if (entry.reset <= now) resetRequests.delete(k);
  const entry = resetRequests.get(key);
  if (!entry || entry.reset <= now) {
    resetRequests.set(key, { count: 1, reset: now + RESET_WINDOW_MS });
    return true;
  }
  return ++entry.count <= max;
}
const INVALID_RESET_LINK =
  "common.passwordResetLinkInvalid";
export const userView = (r: any): User => ({
  id: r.id,
  firstName: r.first_name,
  lastName: r.last_name,
  email: r.email,
  phone: r.phone,
  avatar: r.avatar,
  isDemo: r.is_demo,
  isOwner: r.is_owner === true,
  locale: normalizeLocale(r.locale),
});
export type AuthedRequest = FastifyRequest & { user: User };
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private db: Database,
    private mail: MailService,
  ) {}
  async passwordHash(password: string) {
    const salt = randomBytes(16).toString("hex");
    const key = (await scrypt(password, salt, 64)) as Buffer;
    return `${salt}:${key.toString("hex")}`;
  }
  async register(data: RegisterInput, locale: Locale) {
    const passwordHash = await this.passwordHash(data.password);
    try {
      const [r] = await this.db.query(
        "INSERT INTO users(id,first_name,last_name,email,phone,password_hash,locale) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
        [
          randomUUID(),
          data.firstName,
          data.lastName,
          data.email,
          data.phone,
          passwordHash,
          locale,
        ],
      );
      return userView(r);
    } catch (e: any) {
      if (e.code === "23505")
        throw new ConflictException(
          "errors.emailAddressAlreadyRegistered",
        );
      throw e;
    }
  }
  async login(email: string, password: string) {
    const key = email.toLowerCase();
    const now = Date.now();
    if (loginFailures.size > 10_000)
      for (const [k, entry] of loginFailures)
        if (entry.reset <= now) loginFailures.delete(k);
    const failure = loginFailures.get(key);
    if (failure && failure.reset > now && failure.count >= LOGIN_MAX_FAILURES)
      throw new HttpException(
        "errors.tooManyAttemptsPlease",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const [r] = await this.db.query(
      "SELECT * FROM users WHERE email=$1 AND is_demo=false",
      [email],
    );
    const [salt, expected] = (
      r?.password_hash || "00000000000000000000000000000000:" + "00".repeat(64)
    ).split(":");
    const result = (await scrypt(password, salt, 64)) as Buffer;
    if (
      !r?.password_hash ||
      !timingSafeEqual(result, Buffer.from(expected, "hex"))
    ) {
      const current =
        failure && failure.reset > now
          ? failure
          : { count: 0, reset: now + LOGIN_WINDOW_MS };
      current.count++;
      loginFailures.set(key, current);
      throw new UnauthorizedException(
        "errors.emailAddressPasswordIncorrect",
      );
    }
    loginFailures.delete(key);
    return userView(r);
  }
  cookieOptions() {
    return {
      path: "/api",
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.COOKIE_SECURE === "true",
    };
  }
  async session(user: User, req: FastifyRequest, reply: FastifyReply, kind: "login" | "registration" = "login") {
    if (req.cookies.session)
      await this.db.query("DELETE FROM sessions WHERE token_hash=$1", [
        hash(req.cookies.session),
      ]);
    const token = randomBytes(32).toString("base64url");
    await this.db.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at,platform,app_version) VALUES($1,$2,now()+interval '7 days',$3,$4)",
      [hash(token), user.id, clientPlatform(req), String(req.headers["x-app-version"] || "web").slice(0,64)],
    );
    if (!user.isDemo) {
      // Idioma de la cuenta = el del dominio por el que entra: ahí le llegan los correos
      const locale = requestLocale(req);
      if (user.locale !== locale) {
        await this.db.query("UPDATE users SET locale=$1 WHERE id=$2", [locale, user.id]);
        user = { ...user, locale };
      }
      await this.db.query("INSERT INTO activity(id,kind,platform,user_id) VALUES($1,$2,$3,$4)", [randomUUID(), kind, clientPlatform(req), user.id]);
      if (kind === "registration") await this.db.query("UPDATE users SET registration_platform=$1 WHERE id=$2", [clientPlatform(req), user.id]);
    }
    reply.setCookie("session", token, {
      ...this.cookieOptions(),
      maxAge: 7 * 86400,
    });
    return user;
  }
  /**
   * Envía un enlace para elegir contraseña nueva, en el idioma del dominio por el que
   * entró el usuario, desde el remitente de ese dominio y apuntando a ese dominio.
   * La respuesta es la misma exista o no la cuenta.
   */
  async requestPasswordReset(email: string, req: FastifyRequest) {
    const locale = requestLocale(req);
    if (!allow(`ip:${req.ip}`, RESET_MAX_PER_IP))
      throw new HttpException(
        "errors.tooManyAttemptsPlease",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    const [user] = allow(`email:${email}`, RESET_MAX_PER_EMAIL)
      ? await this.db.query(
          "SELECT id,first_name,email FROM users WHERE email=$1 AND is_demo=false",
          [email],
        )
      : [];
    if (user) {
      const token = randomBytes(32).toString("base64url");
      // Solo vale el último enlace pedido
      await this.db.query("DELETE FROM password_resets WHERE user_id=$1", [user.id]);
      await this.db.query(
        `INSERT INTO password_resets(token_hash,user_id,locale,expires_at) VALUES($1,$2,$3,now()+interval '${PASSWORD_RESET_MINUTES} minutes')`,
        [hash(token), user.id, locale],
      );
      const site = siteUrl(locale);
      // Sin esperar al SMTP: el tiempo de respuesta no revela si la cuenta existe
      void this.mail
        .send(
          locale,
          passwordResetMail(locale, {
            to: user.email,
            name: user.first_name,
            url: `${site}${passwordResetPaths.reset}?token=${token}`,
            site,
            minutes: PASSWORD_RESET_MINUTES,
          }),
        )
        .catch((e: Error) =>
          this.logger.error(`No se pudo enviar el correo de recuperación: ${e.message}`),
        );
    }
    return {
      ok: true,
      message: translate(locale, "account.resetLinkSent"),
    };
  }
  /** Cambia la contraseña con un enlace válido, cierra todas las sesiones y avisa por correo. */
  async resetPassword(token: string, password: string) {
    const passwordHash = await this.passwordHash(password);
    const result = await this.db.transaction(async (c) => {
      const {
        rows: [reset],
      } = await c.query(
        "DELETE FROM password_resets WHERE token_hash=$1 RETURNING user_id, locale, expires_at > now() AS valid",
        [hash(token)],
      );
      if (!reset?.valid) return null;
      const {
        rows: [user],
      } = await c.query(
        "UPDATE users SET password_hash=$1 WHERE id=$2 AND is_demo=false RETURNING *",
        [passwordHash, reset.user_id],
      );
      if (!user) return null;
      await c.query("DELETE FROM password_resets WHERE user_id=$1", [user.id]);
      await c.query("DELETE FROM sessions WHERE user_id=$1", [user.id]);
      return { user, locale: normalizeLocale(reset.locale) };
    });
    if (!result) throw new BadRequestException(INVALID_RESET_LINK);
    loginFailures.delete(result.user.email);
    const site = siteUrl(result.locale);
    void this.mail
      .send(
        result.locale,
        passwordChangedMail(result.locale, {
          to: result.user.email,
          name: result.user.first_name,
          site,
          resetUrl: `${site}${passwordResetPaths.request}`,
        }),
      )
      .catch((e: Error) =>
        this.logger.error(`No se pudo enviar el aviso de contraseña cambiada: ${e.message}`),
      );
    return userView(result.user);
  }
  async current(req: FastifyRequest) {
    if (!req.cookies.session)
      throw new UnauthorizedException("errors.signInToContinue");
    const [r] = await this.db.query(
      "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now()",
      [hash(req.cookies.session)],
    );
    if (!r)
      throw new UnauthorizedException(
        "errors.sessionHasExpiredPlease",
      );
    return userView(r);
  }
  async logout(req: FastifyRequest, reply: FastifyReply) {
    if (req.cookies.session)
      await this.db.query("DELETE FROM sessions WHERE token_hash=$1", [
        hash(req.cookies.session),
      ]);
    reply.clearCookie("session", this.cookieOptions());
    return { ok: true };
  }
  async google(
    credential: string,
    nonce: string,
    req: FastifyRequest,
    reply: FastifyReply,
  ) {
    if (!process.env.GOOGLE_CLIENT_ID)
      throw new ServiceUnavailableException(
        "errors.googleSignHasntBeen",
      );
    const validNonce = req.cookies.google_nonce === nonce;
    reply.clearCookie("google_nonce", this.cookieOptions());
    if (!validNonce)
      throw new BadRequestException(
        "errors.googleRequestHasExpired",
      );
    let payload;
    try {
      const ticket = await new OAuth2Client(
        process.env.GOOGLE_CLIENT_ID,
      ).verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException(
        "errors.couldntVerifyGoogleSign",
      );
    }
    if (
      !payload?.email_verified ||
      !payload.email ||
      (payload as any).nonce !== nonce
    )
      throw new UnauthorizedException("errors.googleDidntConfirmIdentity");
    const [existing] = await this.db.query(
      "SELECT * FROM users WHERE google_sub=$1",
      [payload.sub],
    );
    if (existing) return userView(existing);
    const [sameEmail] = await this.db.query(
      "SELECT id FROM users WHERE email=$1",
      [payload.email.toLowerCase()],
    );
    if (sameEmail)
      throw new ConflictException(
        "errors.alreadyHaveAccountEmail",
      );
    const locale = requestLocale(req);
    try {
      const [r] = await this.db.query(
        "INSERT INTO users(id,first_name,last_name,email,google_sub,locale) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
        [
          randomUUID(),
          payload.given_name || translate(locale, "common.host"),
          payload.family_name || "",
          payload.email.toLowerCase(),
          payload.sub,
          locale,
        ],
      );
      await this.db.query("INSERT INTO activity(id,kind,platform,user_id) VALUES($1,'registration',$2,$3)", [randomUUID(), clientPlatform(req), r.id]);
      await this.db.query("UPDATE users SET registration_platform=$1 WHERE id=$2", [clientPlatform(req),r.id]);
      return userView(r);
    } catch (e: any) {
      if (e.code === "23505")
        throw new ConflictException(
          "errors.accountAlreadyExistsPlease",
        );
      throw e;
    }
  }
}
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    request.user = await this.auth.current(request);
    return true;
  }
}
