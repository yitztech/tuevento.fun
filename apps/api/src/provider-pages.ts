import { Controller, Get, NotFoundException, Param, Req, Res } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import {
  defaultLocale,
  localeForRequest,
  localePrefix,
  providerCategoryLabels,
  providerPath,
  siteLocale,
  siteOriginsFromEnv,
  supportedLocales,
  translate,
  type Locale,
  type ProviderImage,
  type ProviderProfile,
  type ProviderPublic,
} from "@tuevento/contracts";
import { localeEnv, siteUrl } from "./locale-env";
import { ProvidersService } from "./providers";
import { requestLocale } from "./request-locale";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const origins = siteOriginsFromEnv(process.env);
/** Idiomas que se publican: los de un dominio configurado, con los que aloja. */
const publishedLocales = () => supportedLocales.filter((locale) => localeEnv("SITE_URL", locale) !== "");
/** URL pública del perfil en un idioma: dominio, prefijo y ruta traducida. */
const profileUrl = (slug: string, locale: Locale) => `${siteUrl(locale)}${providerPath(slug, locale)}`;

/**
 * Lo que ve cualquiera: sin datos de la cuenta. Con la dirección aproximada no salen la calle
 * ni el código postal, y el punto se redondea a 2 decimales (~1 km).
 */
export function publicView(p: ProviderProfile, updatedAt: Date): ProviderPublic {
  const exact = p.addressVisibility === "exact";
  const round = (n: number) => Math.round(n * 100) / 100;
  const image = (id: string | null): ProviderImage | null => p.images.find((i) => i.id === id) ?? null;
  return {
    slug: p.slug,
    businessName: p.businessName,
    headline: p.headline,
    description: p.description,
    categories: p.categories,
    phone: p.phone,
    whatsapp: p.whatsapp,
    publicEmail: p.publicEmail,
    website: p.website,
    instagramUrl: p.instagramUrl,
    facebookUrl: p.facebookUrl,
    tiktokUrl: p.tiktokUrl,
    address: exact ? p.address : "",
    city: p.city,
    region: p.region,
    postalCode: exact ? p.postalCode : "",
    country: p.country,
    geo: p.geo && (exact ? p.geo : { lat: round(p.geo.lat), lng: round(p.geo.lng) }),
    addressVisibility: p.addressVisibility,
    serviceRadiusKm: p.serviceRadiusKm,
    cover: image(p.coverImageId) ?? p.images[0] ?? null,
    logo: image(p.logoImageId),
    services: p.services,
    images: p.images,
    updatedAt: updatedAt.toISOString(),
  };
}

/**
 * Texto para una cabecera HTTP que nginx inserta tal cual en el HTML: escapado para HTML y
 * en ASCII (lo demás como referencias numéricas), sin saltos de línea.
 */
export function headerHtml(text: string): string {
  let out = "";
  // biome-ignore lint/suspicious/noControlCharactersInRegex: se quitan justo los caracteres de control
  for (const char of text.replace(/[\u0000-\u001f\u007f]+/g, " ").trim()) {
    const code = char.codePointAt(0) ?? 32;
    out += code > 126 || "&<>\"'".includes(char) ? `&#${code};` : char;
  }
  return out;
}

const shorten = (text: string, max: number) => {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
};

/** Título, descripción e imagen de la página de un proveedor en un idioma. */
export function providerSeo(p: ProviderPublic, locale: Locale) {
  const category = p.categories[0] ? translate(locale, providerCategoryLabels[p.categories[0]]) : "";
  const place = [p.city, p.region].filter(Boolean).join(", ");
  return {
    title: translate(locale, "providers.seoTitle", { name: p.businessName, category }),
    description: shorten(
      p.headline ||
        p.description ||
        translate(locale, place ? "providers.seoDescriptionPlace" : "providers.seoDescription", {
          name: p.businessName,
          category,
          place,
        }),
      160,
    ),
    image: p.cover ? `${localeEnv("SITE_URL", locale).replace(/\/+$/, "")}${p.cover.urls[1600]}` : "",
  };
}

@Controller()
export class ProviderPagesController {
  constructor(private providers: ProvidersService) {}

  /** Página pública: una dirección anterior responde con el perfil y su dirección actual. */
  @Get("public/providers/:slug") async profile(@Param("slug") slug: string): Promise<ProviderPublic> {
    const found = slugPattern.test(slug) ? await this.providers.published(slug) : null;
    if (found && "movedTo" in found) {
      const moved = await this.providers.published(found.movedTo);
      if (moved && "profile" in moved) return publicView(moved.profile, moved.updatedAt);
    }
    if (!found || !("profile" in found)) throw new NotFoundException("errors.providerProfileNotFound");
    return publicView(found.profile, found.updatedAt);
  }

  /**
   * Estado de la página para el nginx de `web` (auth_request, AGENTS.md §9.2), sin cuerpo:
   * publicada → 204 con título, descripción e imagen; dirección anterior → 401 con la nueva
   * (301); borrada → 401 (410); cualquier otra → 403 (404). El gateway no la expone.
   */
  @Get("internal/seo/providers/:slug") async seo(
    @Req() req: FastifyRequest,
    @Param("slug") slug: string,
    @Res() reply: FastifyReply,
  ) {
    const found = slugPattern.test(slug) ? await this.providers.published(slug) : null;
    const locale = requestLocale(req);
    if (found && "profile" in found) {
      const seo = providerSeo(publicView(found.profile, found.updatedAt), locale);
      return reply
        .code(204)
        .header("X-Seo-Title", headerHtml(seo.title))
        .header("X-Seo-Description", headerHtml(seo.description))
        .header("X-Seo-Image", headerHtml(seo.image))
        .send();
    }
    if (found && "movedTo" in found) return reply.code(401).header("X-Seo-Redirect", `${localePrefix(locale)}${providerPath(found.movedTo, locale)}`).send();
    return reply.code(found ? 401 : 403).send();
  }

  /** Perfiles publicados en los idiomas del dominio que se visita, con sus hreflang. */
  @Get("public/sitemap/providers.xml") async sitemap(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const host = Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host;
    const domain = localeForRequest(host, undefined, false, origins);
    const all = publishedLocales();
    const own = all.filter((locale) => siteLocale(locale) === domain);
    const urls = (await this.providers.publishedSlugs()).flatMap(({ slug, updatedAt }) =>
      own.map((locale) =>
        [
          "  <url>",
          `    <loc>${profileUrl(slug, locale)}</loc>`,
          `    <lastmod>${updatedAt.toISOString().slice(0, 10)}</lastmod>`,
          ...all.map((alt) => `    <xhtml:link rel="alternate" hreflang="${alt}" href="${profileUrl(slug, alt)}"/>`),
          ...(all.includes(defaultLocale)
            ? [`    <xhtml:link rel="alternate" hreflang="x-default" href="${profileUrl(slug, defaultLocale)}"/>`]
            : []),
          "  </url>",
        ].join("\n"),
      ),
    );
    return reply
      .header("Content-Type", "application/xml; charset=utf-8")
      .header("Cache-Control", "public, max-age=3600")
      .send(
        [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
          ...urls,
          "</urlset>",
          "",
        ].join("\n"),
      );
  }
}
