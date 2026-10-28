import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ServiceUnavailableException,
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { OAuth2Client, type TokenPayload } from "google-auth-library";
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
  type AccountType,
} from "@tuevento/contracts";
import { requestLocale } from "./request-locale";
import { ProblemException } from "./problem";
import { hashPassword, verifyPassword } from "./password";
import { ipKey, limits } from "./rate-limit";
import { MailService } from "./mail";
import { loginLockedMail, passwordChangedMail, passwordResetMail } from "./mail-templates";
import { siteUrl } from "./locale-env";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const INVALID_RESET_LINK =
  "common.passwordResetLinkInvalid";
/** Error de PostgreSQL por un valor repetido en un índice único. */
export const isUniqueViolation = (e: unknown) =>
  (e as { code?: unknown } | null)?.code === "23505";
/** Fila de `users` tal como la devuelve PostgreSQL. */
export type UserRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  avatar: string | null;
  is_demo: boolean;
  is_owner: boolean | null;
  locale: string | null;
  password_hash: string | null;
  public_code: string;
  account_type: AccountType;
};
export const userView = (r: UserRow): User => ({
  id: r.id,
  firstName: r.first_name,
  lastName: r.last_name,
  email: r.email,
  phone: r.phone,
  avatar: r.avatar,
  isDemo: r.is_demo,
  isOwner: r.is_owner === true,
  locale: normalizeLocale(r.locale),
  publicCode: r.public_code,
  accountType: r.account_type,
});
/**
 * Cookies de la API (AGENTS.md §24): con HTTPS llevan el prefijo `__Host-` (Secure, Path=/ y sin
 * Domain: cada dominio tiene la suya). En local y en el CI, sin HTTPS, el navegador rechazaría ese
 * prefijo y se usa el nombre sin él.
 */
const secureCookies = process.env.COOKIE_SECURE === "true";
export const cookieName = (name: string) => (secureCookies ? `__Host-${name}` : name);
export const SESSION_COOKIE = cookieName("session");
export const GOOGLE_NONCE_COOKIE = cookieName("google_nonce");
/**
 * Dispositivo de confianza (OWASP, «device cookies»): el navegador desde el que alguien ya entró
 * bien. Desde él no se aplica el freno de la cuenta, así que un ataque contra tu correo no te deja
 * fuera. El token es aleatorio y la base de datos solo guarda su hash.
 */
export const DEVICE_COOKIE = cookieName("device");
const DEVICE_DAYS = 180;
/** Cookie de sesión anterior (`session`, Path=/api): se lee mientras caduca y se borra al renovar. */
const LEGACY_SESSION_COOKIE = "session";
const legacyCookieOptions = { path: "/api", httpOnly: true, sameSite: "lax" as const, secure: secureCookies };
export const sessionToken = (req: FastifyRequest) =>
  req.cookies[SESSION_COOKIE] || req.cookies[LEGACY_SESSION_COOKIE];
export type AuthedRequest = FastifyRequest & { user: User };
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private db: Database,
    private mail: MailService,
  ) {}
  passwordHash(password: string) {
    return hashPassword(password);
  }
  async register(data: RegisterInput, locale: Locale) {
    const passwordHash = await this.passwordHash(data.password);
    try {
      const [r] = await this.db.query<UserRow>(
        "INSERT INTO users(id,first_name,last_name,email,phone,password_hash,locale,account_type) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
        [
          randomUUID(),
          data.firstName,
          data.lastName,
          data.email,
          data.phone,
          passwordHash,
          locale,
          data.accountType,
        ],
      );
      return userView(r);
    } catch (e: unknown) {
      if (isUniqueViolation(e))
        throw new ConflictException(
          "errors.emailAddressAlreadyRegistered",
        );
      throw e;
    }
  }
  /**
   * Límites (§24): intentos por IP; fallos por cuenta desde cada IP; y, por cuenta desde cualquier
   * IP, un freno progresivo que solo cierra del todo como emergencia (y avisa al dueño). Desde un
   * dispositivo de confianza solo cuentan sus propios fallos.
   */
  async login(email: string, password: string, req: FastifyRequest) {
    const accountKey = `login:account:${email}`;
    const accountIpKey = `login:account-ip:${email}:${req.ip}`;
    limits.loginIp.hit(ipKey("login", req));
    const [r] = await this.db.query<UserRow>(
      "SELECT * FROM users WHERE email=$1 AND is_demo=false",
      [email],
    );
    const device = r ? await this.trustedDevice(req, r.id) : null;
    const deviceKey = `login:device:${device}`;
    if (device) limits.loginDevice.check(deviceKey);
    else {
      limits.loginAccountIp.check(accountIpKey);
      limits.loginAccount.check(accountKey);
    }
    const { valid, rehash } = await verifyPassword(password, r?.password_hash);
    if (!r || !valid) {
      if (device) limits.loginDevice.allow(deviceKey);
      else {
        limits.loginAccountIp.allow(accountIpKey);
        if (limits.loginAccount.fail(accountKey) && r) this.warnLocked(r);
      }
      throw new UnauthorizedException(
        "errors.emailAddressPasswordIncorrect",
      );
    }
    limits.loginAccountIp.reset(accountIpKey);
    limits.loginAccount.reset(accountKey);
    if (device) limits.loginDevice.reset(deviceKey);
    // Los hashes scrypt anteriores pasan a Argon2id al entrar
    if (rehash)
      await this.db.query("UPDATE users SET password_hash=$1 WHERE id=$2", [
        await this.passwordHash(password),
        r.id,
      ]);
    return userView(r);
  }
  /** Hash del dispositivo de confianza de la petición si es de esa cuenta y sigue vigente. */
  private async trustedDevice(req: FastifyRequest, userId: string) {
    const token = req.cookies[DEVICE_COOKIE];
    if (!token) return null;
    const [row] = await this.db.query(
      "SELECT token_hash FROM trusted_devices WHERE token_hash=$1 AND user_id=$2 AND expires_at>now()",
      [hash(token), userId],
    );
    return (row?.token_hash as string | undefined) ?? null;
  }
  /** Aviso al dueño cuando su cuenta se cierra por demasiados intentos. */
  private warnLocked(r: UserRow) {
    const locale = normalizeLocale(r.locale);
    const site = siteUrl(locale);
    void this.mail
      .send(
        locale,
        loginLockedMail(locale, {
          to: r.email,
          name: r.first_name,
          site,
          resetUrl: `${site}${passwordResetPaths.request}`,
        }),
      )
      .catch((e: Error) =>
        this.logger.error(`No se pudo enviar el aviso de cuenta cerrada: ${e.message}`),
      );
  }
  cookieOptions() {
    return {
      path: "/",
      httpOnly: true,
      sameSite: "lax" as const,
      secure: secureCookies,
    };
  }
  async session(user: User, req: FastifyRequest, reply: FastifyReply, kind: "login" | "registration" = "login") {
    const previous = sessionToken(req);
    if (previous)
      await this.db.query("DELETE FROM sessions WHERE token_hash=$1", [
        hash(previous),
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
    if (req.cookies[LEGACY_SESSION_COOKIE] && LEGACY_SESSION_COOKIE !== SESSION_COOKIE)
      reply.clearCookie(LEGACY_SESSION_COOKIE, legacyCookieOptions);
    reply.setCookie(SESSION_COOKIE, token, {
      ...this.cookieOptions(),
      maxAge: 7 * 86400,
    });
    if (!user.isDemo) await this.trustDevice(user.id, req, reply);
    return user;
  }
  /** Marca el navegador como dispositivo de confianza de la cuenta (o renueva el que ya era). */
  private async trustDevice(userId: string, req: FastifyRequest, reply: FastifyReply) {
    const previous = req.cookies[DEVICE_COOKIE];
    if (previous)
      await this.db.query("DELETE FROM trusted_devices WHERE token_hash=$1", [hash(previous)]);
    const device = randomBytes(32).toString("base64url");
    await this.db.query(
      "INSERT INTO trusted_devices(token_hash,user_id,expires_at) VALUES($1,$2,now()+make_interval(days => $3))",
      [hash(device), userId, DEVICE_DAYS],
    );
    reply.setCookie(DEVICE_COOKIE, device, {
      ...this.cookieOptions(),
      maxAge: DEVICE_DAYS * 86400,
    });
  }
  /**
   * Envía un enlace para elegir contraseña nueva, en el idioma del dominio por el que
   * entró el usuario, desde el remitente de ese dominio y apuntando a ese dominio.
   * La respuesta es la misma exista o no la cuenta.
   */
  async requestPasswordReset(email: string, req: FastifyRequest) {
    const locale = requestLocale(req);
    limits.resetIp.hit(ipKey("reset", req));
    // Pasado el límite por correo se responde igual, sin enviar nada: no revela si la cuenta existe
    const [user] = limits.resetAccount.allow(`reset:account:${email}`)
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
      // Contraseña nueva: los dispositivos de confianza vuelven a ganárselo
      await c.query("DELETE FROM trusted_devices WHERE user_id=$1", [user.id]);
      return { user, locale: normalizeLocale(reset.locale) };
    });
    if (!result) throw new BadRequestException(INVALID_RESET_LINK);
    // Quien recupera su cuenta vuelve a entrar aunque estuviera cerrada por intentos ajenos
    limits.loginAccount.reset(`login:account:${result.user.email}`);
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
    const token = sessionToken(req);
    if (!token)
      throw new UnauthorizedException("errors.signInToContinue");
    const [r] = await this.db.query<UserRow>(
      "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now()",
      [hash(token)],
    );
    if (!r)
      throw new UnauthorizedException(
        "errors.sessionHasExpiredPlease",
      );
    return userView(r);
  }
  async logout(req: FastifyRequest, reply: FastifyReply) {
    const token = sessionToken(req);
    if (token)
      await this.db.query("DELETE FROM sessions WHERE token_hash=$1", [
        hash(token),
      ]);
    reply.clearCookie(SESSION_COOKIE, this.cookieOptions());
    if (LEGACY_SESSION_COOKIE !== SESSION_COOKIE)
      reply.clearCookie(LEGACY_SESSION_COOKIE, legacyCookieOptions);
    return { ok: true };
  }
  async google(
    credential: string,
    nonce: string,
    req: FastifyRequest,
    reply: FastifyReply,
    accountType: AccountType = "organizer",
  ) {
    if (!process.env.GOOGLE_CLIENT_ID)
      throw new ServiceUnavailableException(
        "errors.googleSignHasntBeen",
      );
    const validNonce = req.cookies[GOOGLE_NONCE_COOKIE] === nonce;
    reply.clearCookie(GOOGLE_NONCE_COOKIE, this.cookieOptions());
    if (!validNonce)
      throw new BadRequestException(
        "errors.googleRequestHasExpired",
      );
    let payload: TokenPayload | undefined;
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
      payload.nonce !== nonce
    )
      throw new UnauthorizedException("errors.googleDidntConfirmIdentity");
    const [existing] = await this.db.query<UserRow>(
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
      const [r] = await this.db.query<UserRow>(
        "INSERT INTO users(id,first_name,last_name,email,google_sub,locale,account_type) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
        [
          randomUUID(),
          payload.given_name || translate(locale, "common.host"),
          payload.family_name || "",
          payload.email.toLowerCase(),
          payload.sub,
          locale,
          accountType,
        ],
      );
      await this.db.query("INSERT INTO activity(id,kind,platform,user_id) VALUES($1,'registration',$2,$3)", [randomUUID(), clientPlatform(req), r.id]);
      await this.db.query("UPDATE users SET registration_platform=$1 WHERE id=$2", [clientPlatform(req),r.id]);
      return userView(r);
    } catch (e: unknown) {
      if (isUniqueViolation(e))
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

/** Tipo de cuenta que exige un controlador o un endpoint (`@RequireAccountType("organizer")`). */
export const RequireAccountType = Reflector.createDecorator<AccountType>();

/**
 * Cada tipo de cuenta usa solo sus endpoints (AGENTS.md §25): se comprueba aquí, en un solo sitio,
 * después de SessionGuard. Un tipo equivocado responde 403 `wrong_account_type`.
 */
@Injectable()
export class AccountTypeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const required = this.reflector.getAllAndOverride(RequireAccountType, [context.getHandler(), context.getClass()]);
    if (!required) return true;
    const { user } = context.switchToHttp().getRequest<AuthedRequest>();
    if (user?.accountType !== required)
      throw new ProblemException({ status: 403, code: "wrong_account_type", detail: "errors.wrongAccountType" });
    return true;
  }
}
