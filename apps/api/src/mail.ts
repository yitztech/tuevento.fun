import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { createTransport } from "nodemailer";
import { defaultLocale, supportedLocales, type Locale } from "@tuevento/contracts";
import { localeEnv, localeEnvName } from "./locale-env";

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};
type Sender = {
  locale: Locale;
  from: { name: string; address: string } | string;
  transport: ReturnType<typeof createTransport>;
};

/**
 * Correo transaccional por SMTP, un remitente por idioma: el usuario recibe el correo
 * en el idioma del dominio por el que entró y desde ese dominio (`MAIL_FROM_<IDIOMA>`;
 * para el principal vale `MAIL_FROM`). SMTP_HOST, SMTP_PORT y SMTP_SECURE son comunes.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly senders = new Map<Locale, Sender>();

  onModuleInit() {
    for (const locale of supportedLocales) {
      const sender = this.sender(locale);
      if (!sender)
        this.logger.warn(
          `Correo sin configurar: faltan SMTP_HOST o ${localeEnvName("MAIL_FROM", locale, true)}.`,
        );
      else if (sender.locale !== locale)
        this.logger.warn(
          `Sin ${localeEnvName("MAIL_FROM", locale)}: los correos en "${locale}" saldrán desde el remitente de "${sender.locale}".`,
        );
    }
  }

  isConfigured(locale: Locale) {
    return this.sender(locale) !== null;
  }

  /** Envía el correo con el remitente del idioma. false si no hay SMTP configurado. */
  async send(locale: Locale, message: MailMessage): Promise<boolean> {
    const sender = this.sender(locale);
    if (!sender) {
      // En desarrollo se ve el correo en el log para poder seguir el enlace;
      // en producción nunca se escribe su contenido (lleva enlaces de un solo uso).
      if (process.env.NODE_ENV !== "production")
        this.logger.log(
          `[correo sin SMTP, ${locale}] ${message.to} · ${message.subject}\n${message.text}`,
        );
      else this.logger.warn(`Correo sin enviar (${locale}): SMTP sin configurar.`);
      return false;
    }
    await sender.transport.sendMail({
      from: sender.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      headers: { "Content-Language": locale },
    });
    return true;
  }

  /** Remitente del idioma; si ese idioma no tiene MAIL_FROM propio, el del principal. */
  private sender(locale: Locale): Sender | null {
    const cached = this.senders.get(locale);
    if (cached) return cached;
    const host = process.env.SMTP_HOST;
    const own = localeEnv("MAIL_FROM", locale);
    const source: Locale = own ? locale : defaultLocale;
    const from = own || localeEnv("MAIL_FROM", defaultLocale);
    if (!host || !from) return null;
    const secure = process.env.SMTP_SECURE === "true";
    const user = localeEnv("SMTP_USER", source);
    const transport = createTransport({
      host,
      port: Number(process.env.SMTP_PORT || (secure ? 465 : 587)),
      secure,
      ...(user
        ? { auth: { user, pass: localeEnv("SMTP_PASSWORD", source) } }
        : {}),
      // Que un SMTP lento no deje colgada la petición que dispara el correo
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    const sender: Sender = {
      locale: source,
      // "no-reply@tuevento.fun" → "TuEventoFun <no-reply@tuevento.fun>"
      from: from.includes("<") ? from : { name: "TuEventoFun", address: from },
      transport,
    };
    this.senders.set(locale, sender);
    return sender;
  }
}
