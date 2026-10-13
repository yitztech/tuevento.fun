import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ServiceUnavailableException,
  BadRequestException,
  CanActivate,
  ExecutionContext,
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
import type { RegisterInput, User } from "@tuevento/contracts";
const scrypt = promisify(scryptCallback);
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const userView = (r: any): User => ({
  id: r.id,
  firstName: r.first_name,
  lastName: r.last_name,
  email: r.email,
  phone: r.phone,
  username: r.username,
  avatar: r.avatar,
  isDemo: r.is_demo,
  isOwner: r.is_owner === true,
});
export type AuthedRequest = FastifyRequest & { user: User };
@Injectable()
export class AuthService {
  constructor(private db: Database) {}
  async passwordHash(password: string) {
    const salt = randomBytes(16).toString("hex");
    const key = (await scrypt(password, salt, 64)) as Buffer;
    return `${salt}:${key.toString("hex")}`;
  }
  async register(data: RegisterInput) {
    const passwordHash = await this.passwordHash(data.password);
    try {
      const [r] = await this.db.query(
        "INSERT INTO users(id,first_name,last_name,email,phone,username,password_hash) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
        [
          randomUUID(),
          data.firstName,
          data.lastName,
          data.email,
          data.phone,
          data.username,
          passwordHash,
        ],
      );
      return userView(r);
    } catch (e: any) {
      if (e.code === "23505")
        throw new ConflictException(
          "El correo o nombre de usuario ya está registrado.",
        );
      throw e;
    }
  }
  async login(email: string, password: string) {
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
    )
      throw new UnauthorizedException(
        "El correo o la contraseña no coinciden.",
      );
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
      await this.db.query("INSERT INTO activity(id,kind,platform,user_id) VALUES($1,$2,$3,$4)", [randomUUID(), kind, clientPlatform(req), user.id]);
      if (kind === "registration") await this.db.query("UPDATE users SET registration_platform=$1 WHERE id=$2", [clientPlatform(req), user.id]);
    }
    reply.setCookie("session", token, {
      ...this.cookieOptions(),
      maxAge: 7 * 86400,
    });
    return user;
  }
  async current(req: FastifyRequest) {
    if (!req.cookies.session)
      throw new UnauthorizedException("Inicia sesión para continuar.");
    const [r] = await this.db.query(
      "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now()",
      [hash(req.cookies.session)],
    );
    if (!r)
      throw new UnauthorizedException(
        "Tu sesión terminó. Inicia sesión de nuevo.",
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
        "El acceso con Google todavía no está configurado.",
      );
    const validNonce = req.cookies.google_nonce === nonce;
    reply.clearCookie("google_nonce", this.cookieOptions());
    if (!validNonce)
      throw new BadRequestException(
        "La solicitud de Google caducó. Inténtalo de nuevo.",
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
        "No se pudo validar tu acceso con Google.",
      );
    }
    if (
      !payload?.email_verified ||
      !payload.email ||
      (payload as any).nonce !== nonce
    )
      throw new UnauthorizedException("Google no confirmó esta identidad.");
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
        "Ya tienes una cuenta con este correo. Accede con tu contraseña.",
      );
    try {
      const [r] = await this.db.query(
        "INSERT INTO users(id,first_name,last_name,email,username,google_sub) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
        [
          randomUUID(),
          payload.given_name || "Anfitrión",
          payload.family_name || "",
          payload.email.toLowerCase(),
          "anfitrion_" + randomBytes(5).toString("hex"),
          payload.sub,
        ],
      );
      await this.db.query("INSERT INTO activity(id,kind,platform,user_id) VALUES($1,'registration',$2,$3)", [randomUUID(), clientPlatform(req), r.id]);
      await this.db.query("UPDATE users SET registration_platform=$1 WHERE id=$2", [clientPlatform(req),r.id]);
      return userView(r);
    } catch (e: any) {
      if (e.code === "23505")
        throw new ConflictException(
          "La cuenta ya existe. Vuelve a iniciar sesión.",
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
