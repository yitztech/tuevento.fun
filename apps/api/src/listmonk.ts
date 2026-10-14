import { Injectable, Logger } from "@nestjs/common";
import { Database } from "./database";
import type { Locale } from "@tuevento/contracts";

@Injectable()
export class ListmonkService {
  private readonly logger = new Logger(ListmonkService.name);
  private readonly url = (process.env.LISTMONK_URL || "").replace(/\/+$/, "");
  private readonly apiUser = process.env.LISTMONK_API_USER || process.env.LISTMONK_USERNAME || "";
  private readonly apiToken = process.env.LISTMONK_API_TOKEN || process.env.LISTMONK_PASSWORD || "";
  private readonly defaultListId = Number(process.env.LISTMONK_LIST_ID || "1");

  constructor(private db: Database) {}

  isConfigured(): boolean {
    return Boolean(this.url && this.apiUser && this.apiToken);
  }

  async subscribe(email: string, name?: string, locale: Locale = "es") {
    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name?.trim() || null;

    // 1. Persistencia local en PostgreSQL
    try {
      await this.db.query(
        `INSERT INTO newsletter_subscribers (email, name, locale)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET name = COALESCE(EXCLUDED.name, newsletter_subscribers.name), locale = EXCLUDED.locale`,
        [cleanEmail, cleanName, locale],
      );
    } catch (err: any) {
      this.logger.error(`Error guardando suscriptor en BD local: ${err.message}`);
    }

    // 2. Sincronización con Listmonk si está configurado
    if (this.isConfigured()) {
      try {
        const auth = Buffer.from(`${this.apiUser}:${this.apiToken}`).toString("base64");
        const res = await fetch(`${this.url}/api/subscribers`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${auth}`,
          },
          body: JSON.stringify({
            email: cleanEmail,
            name: cleanName || cleanEmail.split("@")[0],
            status: "enabled",
            lists: [this.defaultListId],
            attribs: { locale },
          }),
        });

        if (!res.ok) {
          const body = await res.text().catch(() => "");
          this.logger.warn(`Listmonk API respondió ${res.status}: ${body}`);
        } else {
          this.logger.log(`Suscriptor sincronizado con Listmonk: ${cleanEmail}`);
        }
      } catch (err: any) {
        this.logger.error(`Fallo de conexión con Listmonk: ${err.message}`);
      }
    } else {
      this.logger.debug(`Listmonk no configurado. Suscripción registrada localmente: ${cleanEmail}`);
    }

    return {
      ok: true,
      message:
        locale === "en"
          ? "Thanks for subscribing!"
          : "¡Gracias por suscribirte!",
    };
  }

  async sendTransactional(options: {
    subscriberEmail: string;
    templateId: number;
    data?: Record<string, any>;
    locale?: Locale;
  }) {
    if (!this.isConfigured()) {
      this.logger.debug(
        `[Simulación Email] Listmonk no configurado. Email a ${options.subscriberEmail} (template ${options.templateId})`,
      );
      return { sent: false, simulated: true };
    }

    try {
      const auth = Buffer.from(`${this.apiUser}:${this.apiToken}`).toString("base64");
      const res = await fetch(`${this.url}/api/tx`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          subscriber_email: options.subscriberEmail,
          template_id: options.templateId,
          data: options.data || {},
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        this.logger.warn(`Error enviando correo transaccional Listmonk: ${res.status} ${body}`);
        return { sent: false, error: body };
      }

      return { sent: true };
    } catch (err: any) {
      this.logger.error(`Error en conexión transaccional Listmonk: ${err.message}`);
      return { sent: false, error: err.message };
    }
  }
}
