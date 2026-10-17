import {
  BadRequestException,
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
} from "@tuevento/contracts";
import { Database } from "./database";

/** Carpeta de las fotos subidas; en Docker es un volumen propio (ver compose). */
const imageDir = () => process.env.POSTCARD_IMAGE_DIR || "/data/postcards";
export const postcardImageUrl = (id: string) => `/api/postcards/images/${id}`;

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
      "SELECT id FROM events WHERE id=$1 AND user_id=$2",
      [eventId, userId],
    );
    if (!r) throw new NotFoundException("errors.couldntFindEvent");
  }

  private async photos(eventId: string) {
    const rows = await this.db.query(
      "SELECT id FROM postcard_images WHERE event_id=$1 ORDER BY created_at",
      [eventId],
    );
    return rows.map((r) => ({ id: r.id, url: postcardImageUrl(r.id) }));
  }

  async get(userId: string, eventId: string): Promise<Postcard> {
    await this.ownEvent(userId, eventId);
    const [r] = await this.db.query(
      "SELECT design, updated_at FROM postcards WHERE event_id=$1",
      [eventId],
    );
    return {
      design: r ? r.design : emptyPostcard,
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
      throw new BadRequestException("errors.postcardPhotoLimit");
    const bytes = Buffer.from(dataUrl.split(",")[1], "base64");
    if (bytes.length > postcardLimits.photoBytes)
      throw new BadRequestException("errors.imageMustSmallerThan");
    let output: Buffer;
    try {
      const image = sharp(bytes, { limitInputPixels: 25000000 });
      const metadata = await image.metadata();
      if (!["jpeg", "png", "webp"].includes(metadata.format || ""))
        throw new Error("Unsupported image");
      output = await image
        .rotate()
        .resize(postcardLimits.photoSide, postcardLimits.photoSide, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch {
      throw new BadRequestException("errors.couldntReadImageTry");
    }
    const id = randomUUID();
    await mkdir(imageDir(), { recursive: true });
    await writeFile(join(imageDir(), `${id}.jpg`), output);
    await this.db.query(
      "INSERT INTO postcard_images(id,event_id) VALUES($1,$2)",
      [id, eventId],
    );
    return { id, url: postcardImageUrl(id) };
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

  /** Foto pública por identificador aleatorio (UUID), como los tokens de invitación. */
  async image(imageId: string): Promise<Buffer> {
    const [r] = await this.db.query(
      "SELECT id FROM postcard_images WHERE id=$1",
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
