import {
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import {
  emptyPostcard,
  postcardLimits,
  type Postcard,
  type PostcardDesign,
  type PostcardVersion,
  type UserPostcard,
} from "@tuevento/contracts";
import { Database } from "./database";

/** Carpeta de las fotos subidas; en Docker es un volumen propio (ver compose). */
const imageDir = () => process.env.POSTCARD_IMAGE_DIR || "/data/postcards";
export const postcardImageUrl = (id: string) => `/api/postcards/images/${id}`;

/** Sin postal guardada, la invitación usa la plantilla del tema del evento. */
export function defaultDesign(theme: PostcardTheme): PostcardDesign {
  return { background: { type: "template", theme }, photos: [], texts: [] };
}
type PostcardTheme = Extract<PostcardDesign["background"], { type: "template" }>["theme"];

/** Fotos que un diseño usa: la de fondo (si lo es) y las capas de imagen. */
function photoIds(design: PostcardDesign) {
  const background =
    design.background.type === "photo" ? [design.background.photo] : [];
  return [...background, ...design.photos.map((p) => p.photo)];
}

@Injectable()
export class PostcardsService {
  constructor(private db: Database) {}

  private async ownEvent(userId: string, eventId: string) {
    const [r] = await this.db.query(
      "SELECT id, theme FROM events WHERE id=$1 AND user_id=$2",
      [eventId, userId],
    );
    if (!r) throw new NotFoundException("errors.couldntFindEvent");
    return r;
  }

  private async photos(eventId: string) {
    const rows = await this.db.query(
      "SELECT id FROM postcard_images WHERE event_id=$1 ORDER BY created_at",
      [eventId],
    );
    return rows.map((r) => ({ id: r.id, url: postcardImageUrl(r.id) }));
  }

  async get(userId: string, eventId: string): Promise<Postcard> {
    const event = await this.ownEvent(userId, eventId);
    const [r] = await this.db.query(
      "SELECT design, updated_at FROM postcards WHERE event_id=$1",
      [eventId],
    );
    return {
      design: r ? r.design : defaultDesign(event.theme),
      updatedAt: r ? r.updated_at.toISOString() : null,
      photos: await this.photos(eventId),
    };
  }

  async save(
    userId: string,
    eventId: string,
    design: PostcardDesign,
  ): Promise<Postcard> {
    await this.ownEvent(userId, eventId);
    const used = [...new Set(photoIds(design))];
    if (used.length) {
      const found = await this.db.query(
        "SELECT id FROM postcard_images WHERE event_id=$1 AND id = ANY($2::uuid[])",
        [eventId, used],
      );
      if (found.length !== used.length)
        throw new BadRequestException("errors.postcardPhotoNotFound");
    }
    // Guardar y crear la versión van juntos: nunca hay un diseño sin su versión.
    await this.db.transaction(async (c) => {
      await c.query(
        "INSERT INTO postcards(event_id,design,updated_at) VALUES($1,$2,now()) ON CONFLICT (event_id) DO UPDATE SET design=EXCLUDED.design, updated_at=now()",
        [eventId, JSON.stringify(design)],
      );
      await c.query(
        "INSERT INTO postcard_versions(id,event_id,design,created_at) VALUES($1,$2,$3,clock_timestamp())",
        [randomUUID(), eventId, JSON.stringify(design)],
      );
      await c.query(
        "DELETE FROM postcard_versions WHERE event_id=$1 AND id NOT IN (SELECT id FROM postcard_versions WHERE event_id=$1 ORDER BY created_at DESC LIMIT $2)",
        [eventId, postcardLimits.versions],
      );
    });
    return this.get(userId, eventId);
  }

  async versions(userId: string, eventId: string): Promise<PostcardVersion[]> {
    await this.ownEvent(userId, eventId);
    const rows = await this.db.query(
      "SELECT id, created_at FROM postcard_versions WHERE event_id=$1 ORDER BY created_at DESC LIMIT $2",
      [eventId, postcardLimits.versions],
    );
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.created_at.toISOString(),
    }));
  }

  /** Restaurar una versión la vuelve a guardar: queda como versión nueva y se puede deshacer. */
  async restore(userId: string, eventId: string, versionId: string) {
    await this.ownEvent(userId, eventId);
    const [r] = await this.db.query(
      "SELECT design FROM postcard_versions WHERE id=$1 AND event_id=$2",
      [versionId, eventId],
    );
    if (!r) throw new NotFoundException("errors.postcardVersionNotFound");
    return this.save(userId, eventId, r.design);
  }

  /** Procesa la foto como el avatar: sin metadatos, girada según EXIF y con el lado mayor acotado. */
  async uploadImage(userId: string, eventId: string, dataUrl: string) {
    await this.ownEvent(userId, eventId);
    const [{ n }] = await this.db.query(
      "SELECT count(*)::int AS n FROM postcard_images WHERE event_id=$1",
      [eventId],
    );
    if (n >= postcardLimits.photos)
      throw new ConflictException("errors.postcardPhotoLimit");
    const output = await this.processImage(dataUrl);
    const id = randomUUID();
    await mkdir(imageDir(), { recursive: true });
    await writeFile(join(imageDir(), `${id}.jpg`), output);
    await this.db.query(
      "INSERT INTO postcard_images(id,event_id) VALUES($1,$2)",
      [id, eventId],
    );
    return { id, url: postcardImageUrl(id) };
  }

  private async processImage(dataUrl: string): Promise<Buffer> {
    const bytes = Buffer.from(dataUrl.split(",")[1], "base64");
    if (bytes.length > postcardLimits.photoBytes)
      throw new UnprocessableEntityException("errors.imageMustSmallerThan");
    try {
      const image = sharp(bytes, { limitInputPixels: 25000000 });
      const metadata = await image.metadata();
      if (!["jpeg", "png", "webp"].includes(metadata.format || "")) throw new Error("Unsupported image");
      return await image.rotate().resize(postcardLimits.photoSide, postcardLimits.photoSide, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    } catch { throw new UnprocessableEntityException("errors.couldntReadImageTry"); }
  }

  private async ownDesign(userId: string, id: string) {
    const [row] = await this.db.query("SELECT id, design, updated_at FROM user_postcards WHERE id=$1 AND user_id=$2", [id, userId]);
    if (!row) throw new NotFoundException();
    return row;
  }

  /** Abre una postal nueva. Sigue en borrador, fuera de la lista, hasta guardarla; cada cuenta tiene un solo borrador. */
  async createDesign(userId: string) {
    const [draft] = await this.db.query("SELECT id FROM user_postcards WHERE user_id=$1 AND published=false ORDER BY created_at DESC LIMIT 1", [userId]);
    if (draft) return this.getDesign(userId, draft.id);
    const [{ n }] = await this.db.query("SELECT count(*)::int AS n FROM user_postcards WHERE user_id=$1", [userId]);
    if (n >= postcardLimits.designs) throw new ConflictException("errors.postcardDesignLimit");
    const id = randomUUID();
    await this.db.query("INSERT INTO user_postcards(id,user_id,design) VALUES ($1,$2,$3)", [id, userId, JSON.stringify(emptyPostcard)]);
    return this.getDesign(userId, id);
  }

  async getDesign(userId: string, id: string): Promise<UserPostcard> {
    const row = await this.ownDesign(userId, id);
    const images = await this.db.query("SELECT id FROM user_postcard_images WHERE postcard_id=$1 ORDER BY created_at", [id]);
    return { id, design: row.design, photos: images.map((image) => ({ id: image.id, url: postcardImageUrl(image.id) })), updatedAt: row.updated_at.toISOString() };
  }

  async listDesigns(userId: string): Promise<UserPostcard[]> {
    const rows = await this.db.query(
      `SELECT p.id, p.design, p.updated_at, COALESCE(array_agg(i.id ORDER BY i.created_at) FILTER (WHERE i.id IS NOT NULL), '{}') AS images
       FROM user_postcards p LEFT JOIN user_postcard_images i ON i.postcard_id=p.id
       WHERE p.user_id=$1 AND p.published=true GROUP BY p.id ORDER BY p.created_at DESC, p.id DESC LIMIT $2`,
      [userId, postcardLimits.designs],
    );
    return rows.map((row) => ({
      id: row.id,
      design: row.design,
      photos: row.images.map((image: string) => ({ id: image, url: postcardImageUrl(image) })),
      updatedAt: row.updated_at.toISOString(),
    }));
  }

  /** Borra la postal y sus fotos; quien no es su dueño recibe 404. */
  async removeDesign(userId: string, id: string) {
    await this.ownDesign(userId, id);
    const images = await this.db.query("SELECT id FROM user_postcard_images WHERE postcard_id=$1", [id]);
    await this.db.query("DELETE FROM user_postcards WHERE id=$1 AND user_id=$2", [id, userId]);
    await Promise.all(images.map((image) => unlink(join(imageDir(), `${image.id}.jpg`)).catch(() => {})));
    return { ok: true };
  }

  async saveDesign(userId: string, id: string, design: PostcardDesign) {
    await this.ownDesign(userId, id);
    const used = [...new Set(photoIds(design))];
    if (used.length) {
      const found = await this.db.query("SELECT id FROM user_postcard_images WHERE postcard_id=$1 AND id=ANY($2::uuid[])", [id, used]);
      if (found.length !== used.length) throw new BadRequestException("errors.postcardPhotoNotFound");
    }
    await this.db.query("UPDATE user_postcards SET design=$3, published=true, updated_at=now() WHERE id=$1 AND user_id=$2", [id, userId, JSON.stringify(design)]);
    return this.getDesign(userId, id);
  }

  async uploadDesignImage(userId: string, postcardId: string, dataUrl: string) {
    await this.ownDesign(userId, postcardId);
    const [{ n }] = await this.db.query("SELECT count(*)::int AS n FROM user_postcard_images WHERE postcard_id=$1", [postcardId]);
    if (n >= postcardLimits.photos) throw new ConflictException("errors.postcardPhotoLimit");
    const output = await this.processImage(dataUrl);
    const id = randomUUID();
    await mkdir(imageDir(), { recursive: true });
    await writeFile(join(imageDir(), `${id}.jpg`), output);
    try { await this.db.query("INSERT INTO user_postcard_images(id,postcard_id) VALUES($1,$2)", [id, postcardId]); }
    catch (error) { await unlink(join(imageDir(), `${id}.jpg`)).catch(() => {}); throw error; }
    return { id, url: postcardImageUrl(id) };
  }

  async removeDesignImage(userId: string, postcardId: string, imageId: string) {
    const row = await this.ownDesign(userId, postcardId);
    const [removed] = await this.db.query("DELETE FROM user_postcard_images WHERE id=$1 AND postcard_id=$2 RETURNING id", [imageId, postcardId]);
    if (!removed) throw new NotFoundException("errors.postcardPhotoNotFound");
    const design: PostcardDesign = row.design;
    const cleaned = { ...design, background: design.background.type === "photo" && design.background.photo === imageId ? { type: "color" as const, color: "#ffffff" } : design.background, photos: design.photos.filter((photo) => photo.photo !== imageId) };
    await this.db.query("UPDATE user_postcards SET design=$3,updated_at=now() WHERE id=$1 AND user_id=$2", [postcardId, userId, JSON.stringify(cleaned)]);
    await unlink(join(imageDir(), `${imageId}.jpg`)).catch(() => {});
    return this.getDesign(userId, postcardId);
  }

  /** Borra la foto y la quita del diseño actual, para que nunca quede una referencia rota. */
  async removeImage(userId: string, eventId: string, imageId: string) {
    await this.ownEvent(userId, eventId);
    const [r] = await this.db.query(
      "DELETE FROM postcard_images WHERE id=$1 AND event_id=$2 RETURNING id",
      [imageId, eventId],
    );
    if (!r) throw new NotFoundException("errors.postcardPhotoNotFound");
    await unlink(join(imageDir(), `${imageId}.jpg`)).catch(() => {});
    const [current] = await this.db.query(
      "SELECT design FROM postcards WHERE event_id=$1",
      [eventId],
    );
    if (current) {
      const design: PostcardDesign = current.design;
      const background =
        design.background.type === "photo" &&
        design.background.photo === imageId
          ? { type: "color" as const, color: "#ffffff" }
          : design.background;
      const cleaned = {
        ...design,
        background,
        photos: design.photos.filter((p) => p.photo !== imageId),
      };
      await this.db.query(
        "UPDATE postcards SET design=$2, updated_at=now() WHERE event_id=$1",
        [eventId, JSON.stringify(cleaned)],
      );
    }
    return this.get(userId, eventId);
  }

  /** Postal que ve el invitado: el diseño guardado (o el del tema) y sus fotos. */
  async publicPostcard(eventId: string, theme: PostcardTheme) {
    const [r] = await this.db.query(
      "SELECT design FROM postcards WHERE event_id=$1",
      [eventId],
    );
    return {
      design: r ? r.design : defaultDesign(theme),
      photos: await this.photos(eventId),
    };
  }

  /** Foto pública por identificador aleatorio (UUID), como los tokens de invitación. */
  async image(imageId: string): Promise<Buffer> {
    const [r] = await this.db.query(
      "SELECT id FROM postcard_images WHERE id=$1 UNION ALL SELECT id FROM user_postcard_images WHERE id=$1",
      [imageId],
    );
    if (!r) throw new NotFoundException("errors.postcardPhotoNotFound");
    return readFile(join(imageDir(), `${imageId}.jpg`));
  }

  /** Al borrar un evento se borran también sus fotos del disco (las filas caen en cascada). */
  async purge(eventId: string) {
    const rows = await this.db.query(
      "SELECT id FROM postcard_images WHERE event_id=$1",
      [eventId],
    );
    await Promise.all(
      rows.map((r) => unlink(join(imageDir(), `${r.id}.jpg`)).catch(() => {})),
    );
  }
}
