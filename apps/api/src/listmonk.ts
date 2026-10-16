import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Database } from "./database";
import { domainLocales, translate, type Locale } from "@tuevento/contracts";
import { localeEnvName, localeEnv } from "./locale-env";

/**
 * Newsletter con un Listmonk por idioma (en `news.` de cada dominio), según el contrato
 * de la plataforma: `LISTMONK_URL_<IDIOMA>` y `LISTMONK_LIST_UUID_<IDIOMA>` (sin sufijo
 * para el principal).
 * Se usa la suscripción pública de Listmonk, que no necesita credenciales: si la lista
 * es de doble confirmación, Listmonk envía el correo para confirmar desde su dominio,
 * y las campañas salen en el idioma de la lista.
 */
@Injectable()
export class ListmonkService implements OnModuleInit {
  private readonly logger = new Logger(ListmonkService.name);

  constructor(private db: Database) {}

  onModuleInit() {
    for (const locale of domainLocales)
      if (!this.target(locale))
        this.logger.warn(
          `Newsletter "${locale}" sin Listmonk: faltan ${localeEnvName("LISTMONK_URL", locale, true)} o ${localeEnvName("LISTMONK_LIST_UUID", locale, true)}. Las altas se guardan solo en la base de datos.`,
        );
  }

  private target(locale: Locale) {
    const url = localeEnv("LISTMONK_URL", locale).replace(/\/+$/, "");
    const list = localeEnv("LISTMONK_LIST_UUID", locale);
    return url && list ? { url, list } : null;
  }

  async subscribe(email: string, name: string | undefined, locale: Locale) {
    const cleanEmail = email.toLowerCase().trim();
    const cleanName = name?.trim() || null;

    // Copia local: sirve de respaldo si Listmonk no responde
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

    const target = this.target(locale);
    if (target) {
      try {
        const res = await fetch(`${target.url}/api/public/subscription`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: cleanEmail,
            name: cleanName || cleanEmail.split("@")[0],
            list_uuids: [target.list],
          }),
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          this.logger.warn(`Listmonk (${locale}) respondió ${res.status}: ${body.slice(0, 300)}`);
        }
      } catch (err: any) {
        this.logger.error(`Fallo de conexión con Listmonk (${locale}): ${err.message}`);
      }
    }

    return {
      ok: true,
      message: translate(
        locale,
        target ? "newsletter.thanksCheckEmailConfirm" : "newsletter.thanks",
      ),
    };
  }
}
