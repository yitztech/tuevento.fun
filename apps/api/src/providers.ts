import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PoolClient } from "pg";
import sharp from "sharp";
import { z } from "zod";
import {
  accountLimits,
  eventSlugPattern,
  providerCompleteness,
  providerImageChoiceSchema,
  providerImageSizes,
  providerImageUpdateSchema,
  providerImageUploadSchema,
  providerLimits,
  providerOrderSchema,
  providerProfileSchema,
  providerRequirementLabels,
  providerServiceSchema,
  reservedProviderSlugs,
  slugify,
  type ProviderImage,
  type ProviderImageSize,
  type ProviderProfile,
  type ProviderProfileData,
  type ProviderService,
} from "@tuevento/contracts";
import { AccountTypeGuard, AuthService, RequireAccountType, SessionGuard, type AuthedRequest } from "./auth";
import { Database } from "./database";
import { parse, ProblemException } from "./problem";

/** Carpeta de las fotos de los proveedores: el volumen provider_uploads (ver compose). */
const imageDir = () => process.env.PROVIDER_IMAGE_DIR || "/data/providers";
const imageFile = (id: string, size: ProviderImageSize) => join(imageDir(), `${id}-${size}.jpg`);
export const providerImageUrl = (id: string, size: ProviderImageSize) => `/api/public/providers/images/${id}/${size}`;

type Queryable = Pick<PoolClient, "query">;
type ProfileRow = {
  id: string;
  slug: string;
  business_name: string;
  headline: string;
  description: string;
  phone: string;
  whatsapp: string;
  public_email: string;
  website: string;
  instagram_url: string;
  facebook_url: string;
  tiktok_url: string;
  address: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  address_visibility: "exact" | "approximate";
  service_radius_km: string;
  status: ProviderProfile["status"];
  published_at: Date | null;
  cover_image_id: string | null;
  logo_image_id: string | null;
};

const notFound = () => new NotFoundException("errors.providerProfileNotFound");
const serviceNotFound = () => new NotFoundException("errors.providerServiceNotFound");
const imageNotFound = () => new NotFoundException("errors.providerImageNotFound");

function imageView(r: { id: string; alt: string; service_id: string | null; width: string; height: string }): ProviderImage {
  return {
    id: r.id,
    alt: r.alt,
    serviceId: r.service_id,
    width: Number(r.width),
    height: Number(r.height),
    urls: Object.fromEntries(providerImageSizes.map((size) => [size, providerImageUrl(r.id, size)])) as ProviderImage["urls"],
  };
}

function serviceView(r: {
  id: string;
  title: string;
  description: string;
  price_from_cents: string | null;
  currency: string | null;
  price_unit: string | null;
}): ProviderService {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    price:
      r.price_from_cents === null
        ? null
        : { fromCents: Number(r.price_from_cents), currency: r.currency, unit: r.price_unit } as ProviderService["price"],
  };
}

@Injectable()
export class ProvidersService {
  constructor(private db: Database) {}

  /** Perfil de la cuenta, o null si aún no guardó los datos de su negocio. */
  async profile(userId: string, db: Queryable = this.db.pool): Promise<ProviderProfile | null> {
    const { rows: [r] } = await db.query<ProfileRow>("SELECT * FROM provider_profiles WHERE user_id=$1", [userId]);
    if (!r) return null;
    const [{ rows: categories }, { rows: services }, { rows: images }] = await Promise.all([
      db.query("SELECT category FROM provider_categories WHERE provider_id=$1 ORDER BY category", [r.id]),
      db.query("SELECT * FROM provider_services WHERE provider_id=$1 ORDER BY position, created_at", [r.id]),
      db.query("SELECT * FROM provider_images WHERE provider_id=$1 ORDER BY position, created_at", [r.id]),
    ]);
    const data: ProviderProfileData = {
      slug: r.slug,
      businessName: r.business_name,
      headline: r.headline,
      description: r.description,
      categories: categories.map((c) => c.category),
      phone: r.phone,
      whatsapp: r.whatsapp,
      publicEmail: r.public_email,
      website: r.website,
      instagramUrl: r.instagram_url,
      facebookUrl: r.facebook_url,
      tiktokUrl: r.tiktok_url,
      address: r.address,
      city: r.city,
      region: r.region,
      postalCode: r.postal_code,
      country: r.country,
      geo: r.latitude === null || r.longitude === null ? null : { lat: r.latitude, lng: r.longitude },
      addressVisibility: r.address_visibility,
      serviceRadiusKm: Number(r.service_radius_km),
    };
    const imageList = images.map(imageView);
    return {
      ...data,
      id: r.id,
      status: r.status,
      publishedAt: r.published_at?.toISOString() ?? null,
      coverImageId: r.cover_image_id,
      logoImageId: r.logo_image_id,
      services: services.map(serviceView),
      images: imageList,
      missing: providerCompleteness({ ...data, images: imageList }),
    };
  }

  /** Identificador del perfil de la cuenta, bloqueado hasta el final de la transacción. */
  private async lockProfile(db: Queryable, userId: string) {
    const { rows: [r] } = await db.query<{ id: string; slug: string; status: string }>(
      "SELECT id, slug, status FROM provider_profiles WHERE user_id=$1 FOR UPDATE",
      [userId],
    );
    if (!r) throw notFound();
    return r;
  }

  /** Una página publicada que deja de cumplir los requisitos vuelve a borrador: nunca queda a medias. */
  private async recheck(db: Queryable, userId: string) {
    const profile = await this.profile(userId, db);
    if (profile?.status === "published" && profile.missing.length)
      await db.query("UPDATE provider_profiles SET status='draft' WHERE id=$1", [profile.id]);
  }

  /** ¿La usa otro negocio, ahora o antes, o es de un perfil borrado? */
  private async slugTaken(db: Queryable, slug: string, providerId: string | null) {
    if ((reservedProviderSlugs as readonly string[]).includes(slug)) return true;
    const { rows } = await db.query(
      `SELECT 1 FROM provider_profiles WHERE slug=$1 AND ($2::uuid IS NULL OR id<>$2)
       UNION ALL SELECT 1 FROM provider_slug_history WHERE slug=$1 AND ($2::uuid IS NULL OR provider_id<>$2)
       UNION ALL SELECT 1 FROM provider_deleted_slugs WHERE slug=$1`,
      [slug, providerId],
    );
    return rows.length > 0;
  }

  async slugAvailable(userId: string, slug: string) {
    const { rows: [own] } = await this.db.pool.query("SELECT id FROM provider_profiles WHERE user_id=$1", [userId]);
    return { available: !(await this.slugTaken(this.db.pool, slug, own?.id ?? null)) };
  }

  /** Dirección a partir del nombre del negocio, libre: la limpia y, si está ocupada, con -2, -3… */
  private async freeSlug(db: Queryable, name: string, providerId: string | null) {
    let base = slugify(name, accountLimits.providerSlug - 5);
    if (base.length < 3) base = base ? `negocio-${base}` : "negocio";
    for (let n = 1; ; n++) {
      const candidate = n === 1 ? base : `${base}-${n}`;
      if (!(await this.slugTaken(db, candidate, providerId))) return candidate;
    }
  }

  async saveProfile(userId: string, input: ProviderProfileData) {
    return this.db.transaction(async (db) => {
      const { rows: [current] } = await db.query<{ id: string; slug: string; status: string }>(
        "SELECT id, slug, status FROM provider_profiles WHERE user_id=$1 FOR UPDATE",
        [userId],
      );
      const id = current?.id ?? randomUUID();
      const slug = input.slug || current?.slug || (await this.freeSlug(db, input.businessName, current?.id ?? null));
      if (slug !== current?.slug && (await this.slugTaken(db, slug, current?.id ?? null)))
        throw new ConflictException("errors.providerSlugTaken");
      const values = [
        id, userId, slug, input.businessName, input.headline, input.description, input.phone, input.whatsapp,
        input.publicEmail, input.website, input.instagramUrl, input.facebookUrl, input.tiktokUrl, input.address,
        input.city, input.region, input.postalCode, input.country, input.geo?.lat ?? null, input.geo?.lng ?? null,
        input.addressVisibility, input.serviceRadiusKm,
      ];
      if (current) {
        await db.query(
          `UPDATE provider_profiles SET slug=$3, business_name=$4, headline=$5, description=$6, phone=$7, whatsapp=$8,
             public_email=$9, website=$10, instagram_url=$11, facebook_url=$12, tiktok_url=$13, address=$14, city=$15,
             region=$16, postal_code=$17, country=$18, latitude=$19, longitude=$20, address_visibility=$21,
             service_radius_km=$22
           WHERE id=$1 AND user_id=$2`,
          values,
        );
        if (slug !== current.slug) {
          // La dirección anterior de una página que ya se vio responderá 301 a la nueva (fase 4)
          if (current.status !== "draft")
            await db.query(
              "INSERT INTO provider_slug_history(slug, provider_id) VALUES($1,$2) ON CONFLICT (slug) DO NOTHING",
              [current.slug, id],
            );
          await db.query("DELETE FROM provider_slug_history WHERE slug=$1 AND provider_id=$2", [slug, id]);
        }
      } else {
        await db.query(
          `INSERT INTO provider_profiles(id, user_id, slug, business_name, headline, description, phone, whatsapp,
             public_email, website, instagram_url, facebook_url, tiktok_url, address, city, region, postal_code,
             country, latitude, longitude, address_visibility, service_radius_km)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
          values,
        );
      }
      await db.query("DELETE FROM provider_categories WHERE provider_id=$1", [id]);
      if (input.categories.length)
        await db.query(
          "INSERT INTO provider_categories(provider_id, category) SELECT $1, unnest($2::text[])",
          [id, input.categories],
        );
      await this.recheck(db, userId);
      return (await this.profile(userId, db)) as ProviderProfile;
    });
  }

  async publish(userId: string, publish: boolean) {
    return this.db.transaction(async (db) => {
      const locked = await this.lockProfile(db, userId);
      if (locked.status === "suspended")
        throw new ProblemException({ status: 409, code: "provider_suspended", detail: "errors.providerSuspended" });
      if (publish) {
        const profile = (await this.profile(userId, db)) as ProviderProfile;
        if (profile.missing.length)
          throw new ProblemException({
            status: 422,
            code: "provider_not_complete",
            detail: "errors.providerNotComplete",
            errors: profile.missing.map((m) => ({ field: m, code: `missing_${m}`, message: providerRequirementLabels[m] })),
          });
        await db.query(
          "UPDATE provider_profiles SET status='published', published_at=coalesce(published_at, now()) WHERE id=$1",
          [locked.id],
        );
      } else await db.query("UPDATE provider_profiles SET status='draft' WHERE id=$1", [locked.id]);
      return (await this.profile(userId, db)) as ProviderProfile;
    });
  }

  async createService(userId: string, input: z.infer<typeof providerServiceSchema>) {
    return this.db.transaction(async (db) => {
      const { id: providerId } = await this.lockProfile(db, userId);
      const { rows: [{ n }] } = await db.query("SELECT count(*)::int AS n FROM provider_services WHERE provider_id=$1", [providerId]);
      if (n >= providerLimits.services) throw new UnprocessableEntityException("errors.providerServiceLimit");
      const { rows: [r] } = await db.query(
        `INSERT INTO provider_services(id, provider_id, title, description, price_from_cents, currency, price_unit, position)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [randomUUID(), providerId, input.title, input.description, input.price?.fromCents ?? null,
          input.price?.currency ?? null, input.price?.unit ?? null, n],
      );
      return serviceView(r);
    });
  }

  async updateService(userId: string, serviceId: string, input: z.infer<typeof providerServiceSchema>) {
    // El servicio se busca junto con la cuenta: el de otro proveedor no existe para quien pregunta
    const [r] = await this.db.query(
      `UPDATE provider_services s SET title=$3, description=$4, price_from_cents=$5, currency=$6, price_unit=$7
       FROM provider_profiles p
       WHERE s.id=$1 AND s.provider_id=p.id AND p.user_id=$2 RETURNING s.*`,
      [serviceId, userId, input.title, input.description, input.price?.fromCents ?? null,
        input.price?.currency ?? null, input.price?.unit ?? null],
    );
    if (!r) throw serviceNotFound();
    return serviceView(r);
  }

  async removeService(userId: string, serviceId: string) {
    const [r] = await this.db.query(
      `DELETE FROM provider_services s USING provider_profiles p
       WHERE s.id=$1 AND s.provider_id=p.id AND p.user_id=$2 RETURNING s.id`,
      [serviceId, userId],
    );
    if (!r) throw serviceNotFound();
  }

  /** Nuevo orden: tienen que llegar todos los elementos, sin faltar ni sobrar ninguno. */
  async reorder(userId: string, table: "provider_services" | "provider_images", ids: string[]) {
    await this.db.transaction(async (db) => {
      const { id: providerId } = await this.lockProfile(db, userId);
      const { rows } = await db.query(`SELECT id FROM ${table} WHERE provider_id=$1`, [providerId]);
      const current = new Set(rows.map((r) => r.id as string));
      if (current.size !== ids.length || ids.some((id) => !current.has(id)))
        throw new ProblemException({ status: 409, code: "order_mismatch", detail: "errors.providerOrderMismatch" });
      await db.query(
        `UPDATE ${table} t SET position=o.n - 1 FROM unnest($2::uuid[]) WITH ORDINALITY AS o(id, n)
         WHERE t.id=o.id AND t.provider_id=$1`,
        [providerId, ids],
      );
    });
    return this.profile(userId);
  }

  /** Como las fotos de la postal: tipo por contenido, sin metadatos (EXIF) y con dos tamaños. */
  async uploadImage(userId: string, input: z.infer<typeof providerImageUploadSchema>) {
    const bytes = Buffer.from(input.dataUrl.split(",")[1], "base64");
    if (bytes.length > providerLimits.imageBytes) throw new UnprocessableEntityException("errors.imageMustSmallerThan");
    let outputs: { size: ProviderImageSize; data: Buffer; width: number; height: number }[];
    try {
      const metadata = await sharp(bytes, { limitInputPixels: 25000000 }).metadata();
      if (!["jpeg", "png", "webp"].includes(metadata.format || "")) throw new Error("Unsupported image");
      outputs = await Promise.all(
        providerImageSizes.map(async (size) => {
          const { data, info } = await sharp(bytes, { limitInputPixels: 25000000 })
            .rotate()
            .resize(size, size, { fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 82 })
            .toBuffer({ resolveWithObject: true });
          return { size, data, width: info.width, height: info.height };
        }),
      );
    } catch {
      throw new UnprocessableEntityException("errors.couldntReadImageTry");
    }
    const id = randomUUID();
    await this.db.transaction(async (db) => {
      // Con el perfil bloqueado, dos subidas a la vez no superan las cuotas
      const { id: providerId } = await this.lockProfile(db, userId);
      const { rows: [{ n }] } = await db.query("SELECT count(*)::int AS n FROM provider_images WHERE provider_id=$1", [providerId]);
      if (n >= providerLimits.images) throw new UnprocessableEntityException("errors.providerImageLimit");
      if (input.serviceId) await this.checkService(db, providerId, input.serviceId);
      const [large] = outputs;
      await mkdir(imageDir(), { recursive: true });
      await Promise.all(outputs.map((o) => writeFile(imageFile(id, o.size), o.data)));
      await db.query(
        "INSERT INTO provider_images(id, provider_id, service_id, alt, width, height, position) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [id, providerId, input.serviceId, input.alt, large.width, large.height, n],
      );
    }).catch(async (e) => {
      await Promise.all(providerImageSizes.map((size) => unlink(imageFile(id, size)).catch(() => {})));
      throw e;
    });
    return this.profile(userId);
  }

  /** El servicio es del mismo perfil y aún le cabe otra foto. */
  private async checkService(db: Queryable, providerId: string, serviceId: string, imageId?: string) {
    const { rows: [s] } = await db.query(
      `SELECT (SELECT count(*)::int FROM provider_images WHERE service_id=s.id AND ($3::uuid IS NULL OR id<>$3)) AS n
       FROM provider_services s WHERE s.id=$1 AND s.provider_id=$2`,
      [serviceId, providerId, imageId ?? null],
    );
    if (!s) throw serviceNotFound();
    if (s.n >= providerLimits.imagesPerService) throw new UnprocessableEntityException("errors.providerImagesPerServiceLimit");
  }

  async updateImage(userId: string, imageId: string, input: z.infer<typeof providerImageUpdateSchema>) {
    return this.db.transaction(async (db) => {
      const { id: providerId } = await this.lockProfile(db, userId);
      if (input.serviceId) await this.checkService(db, providerId, input.serviceId, imageId);
      const { rows: [r] } = await db.query(
        "UPDATE provider_images SET alt=$3, service_id=$4 WHERE id=$1 AND provider_id=$2 RETURNING id",
        [imageId, providerId, input.alt, input.serviceId],
      );
      if (!r) throw imageNotFound();
      await this.recheck(db, userId);
      return (await this.profile(userId, db)) as ProviderProfile;
    });
  }

  async removeImage(userId: string, imageId: string) {
    const profile = await this.db.transaction(async (db) => {
      const { id: providerId } = await this.lockProfile(db, userId);
      const { rows: [r] } = await db.query("DELETE FROM provider_images WHERE id=$1 AND provider_id=$2 RETURNING id", [imageId, providerId]);
      if (!r) throw imageNotFound();
      await this.recheck(db, userId);
      return (await this.profile(userId, db)) as ProviderProfile;
    });
    await Promise.all(providerImageSizes.map((size) => unlink(imageFile(imageId, size)).catch(() => {})));
    return profile;
  }

  async chooseImage(userId: string, column: "cover_image_id" | "logo_image_id", imageId: string | null) {
    await this.db.transaction(async (db) => {
      const { id: providerId } = await this.lockProfile(db, userId);
      if (imageId) {
        const { rows } = await db.query("SELECT 1 FROM provider_images WHERE id=$1 AND provider_id=$2", [imageId, providerId]);
        if (!rows.length) throw imageNotFound();
      }
      await db.query(`UPDATE provider_profiles SET ${column}=$2 WHERE id=$1`, [providerId, imageId]);
    });
    return this.profile(userId);
  }

  /** Foto de un perfil publicado, o de un borrador si quien la pide es su dueño. */
  async image(imageId: string, size: number, viewerId: string | null) {
    if (!(providerImageSizes as readonly number[]).includes(size)) throw imageNotFound();
    const [r] = await this.db.query(
      `SELECT p.status, p.user_id FROM provider_images i JOIN provider_profiles p ON p.id=i.provider_id WHERE i.id=$1`,
      [imageId],
    );
    if (!r || (r.status !== "published" && r.user_id !== viewerId)) throw imageNotFound();
    const bytes = await readFile(imageFile(imageId, size as ProviderImageSize)).catch(() => {
      throw imageNotFound();
    });
    return { bytes, published: r.status === "published" };
  }
}

/** Panel del proveedor: solo cuentas que ofrecen servicios (AGENTS.md §25). */
@Controller("provider")
@UseGuards(SessionGuard, AccountTypeGuard)
@RequireAccountType("provider")
export class ProviderController {
  constructor(private providers: ProvidersService) {}

  @Get("profile") async profile(@Req() req: AuthedRequest) {
    return { profile: await this.providers.profile(req.user.id) };
  }
  @Put("profile") saveProfile(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.providers.saveProfile(req.user.id, parse(providerProfileSchema, body, req));
  }
  @Get("slug-available") slugAvailable(@Req() req: AuthedRequest, @Query() query: unknown) {
    const { slug } = parse(
      z.strictObject({ slug: z.string().trim().toLowerCase().max(accountLimits.providerSlug) }),
      query,
      req,
      400,
    );
    if (slug.length < 3 || !eventSlugPattern.test(slug)) return { available: false };
    return this.providers.slugAvailable(req.user.id, slug);
  }
  @Post("publish") @HttpCode(200) publish(@Req() req: AuthedRequest) {
    return this.providers.publish(req.user.id, true);
  }
  @Post("unpublish") @HttpCode(200) unpublish(@Req() req: AuthedRequest) {
    return this.providers.publish(req.user.id, false);
  }

  @Post("services") createService(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.providers.createService(req.user.id, parse(providerServiceSchema, body, req));
  }
  // Antes que services/:id: si no, «order» se leería como un identificador
  @Put("services/order") orderServices(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.providers.reorder(req.user.id, "provider_services", parse(providerOrderSchema, body, req).ids);
  }
  @Put("services/:id") updateService(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.providers.updateService(req.user.id, id, parse(providerServiceSchema, body, req));
  }
  @Delete("services/:id") @HttpCode(204) async removeService(@Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string) {
    await this.providers.removeService(req.user.id, id);
  }

  @Post("images") uploadImage(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.providers.uploadImage(req.user.id, parse(providerImageUploadSchema, body, req));
  }
  @Put("images/order") orderImages(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.providers.reorder(req.user.id, "provider_images", parse(providerOrderSchema, body, req).ids);
  }
  @Patch("images/:id") updateImage(
    @Req() req: AuthedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.providers.updateImage(req.user.id, id, parse(providerImageUpdateSchema, body, req));
  }
  @Delete("images/:id") removeImage(@Req() req: AuthedRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.providers.removeImage(req.user.id, id);
  }
  @Put("cover") cover(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.providers.chooseImage(req.user.id, "cover_image_id", parse(providerImageChoiceSchema, body, req).imageId);
  }
  @Put("logo") logo(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.providers.chooseImage(req.user.id, "logo_image_id", parse(providerImageChoiceSchema, body, req).imageId);
  }
}

/** Fotos de los proveedores, sin sesión: las de un borrador solo las ve su dueño. */
@Controller("public/providers")
export class ProviderImagesController {
  constructor(
    private providers: ProvidersService,
    private auth: AuthService,
  ) {}
  @Get("images/:id/:size") async image(
    @Req() req: FastifyRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("size") size: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const viewer = await this.auth.current(req).catch(() => null);
    const { bytes, published } = await this.providers.image(id, Number(size), viewer?.id ?? null);
    reply.header("Cache-Control", published ? "public, max-age=31536000, immutable" : "private, no-store");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.type("image/jpeg");
    return bytes;
  }
}
