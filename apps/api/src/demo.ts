import { Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID, randomBytes } from "node:crypto";
import { Database } from "./database";
import { EventsService } from "./events";
import { userView } from "./auth";
import {
  defaultLocale,
  notificationMessage,
  type Locale,
  type Status,
} from "@tuevento/contracts";
@Injectable()
export class DemoService {
  constructor(
    private db: Database,
    private events: EventsService,
  ) {}
  async create(locale: Locale = defaultLocale) {
    if (process.env.DEMO_ENABLED !== "true") throw new NotFoundException();
    const id = randomUUID(),
      unique = randomBytes(8).toString("hex");
    const [row] = await this.db.query(
      "INSERT INTO users(id,first_name,last_name,email,is_demo,locale) VALUES($1,'Andrea','López',$2,true,$3) RETURNING *",
      [id, `demo-${unique}@example.invalid`, locale],
    );
    try {
      const names = [
        "Familia García",
        "Mariana Torres",
        "Familia Rivera",
        "Diego Sánchez",
        "Familia Flores",
        "Camila Ruiz",
        "Familia Mendoza",
        "Valeria Cruz",
      ];
      for (const [index, entry] of [
        {
          title: "La boda de Sofía & Alejandro",
          theme: "floral" as const,
          location: "Jardín Las Bugambilias",
          description:
            "Nos hace mucha ilusión compartir este día contigo. Acompáñanos a celebrar el comienzo de nuestra nueva historia. Vestimenta: formal.",
        },
        {
          title: "¡Felices 30, Mariana!",
          theme: "gold" as const,
          location: "Terraza del Lago",
          description:
            "Una noche para brindar, bailar y celebrar lo que viene. ¡Tu presencia es el mejor regalo!",
        },
        {
          title: "Un domingo entre amigos",
          theme: "tropical" as const,
          location: "Casa del Sol",
          description:
            "Trae tus ganas de pasarla bien. Habrá música, algo rico para compartir y una tarde junto a la piscina.",
        },
      ].entries()) {
        const date = new Date();
        date.setUTCDate(date.getUTCDate() + 18 + index * 14);
        date.setUTCHours(23, 0, 0, 0);
        const event = await this.events.saveEvent(id, {
          ...entry,
          date: date.toISOString(),
          timeZone: "America/Mexico_City",
          archived: false,
          cancelled: false,
          slug: "",
        });
        for (const [i, name] of names.entries()) {
          const family = name.startsWith("Familia");
          const invitation = await this.events.saveInvitation(id, event.id, {
            name,
            email: "",
            phone: "",
            notes: "",
            kind: family ? "family" : "individual",
            members: family
              ? [
                  {
                    name: name.replace("Familia", "Ana"),
                    kind: "adult",
                    notes: "",
                  },
                  {
                    name: name.replace("Familia", "Luis"),
                    kind: "adult",
                    notes: "",
                  },
                  {
                    name: name.replace("Familia", "Sofía"),
                    kind: "child",
                    notes: i === 0 ? "Menú sin nueces." : "",
                  },
                ]
              : [{ name, kind: "adult", notes: "" }],
          });
          const status: Status =
            i < 5 ? "accepted" : i === 6 ? "declined" : "pending";
          await this.db.query(
            "UPDATE members SET status=$1 WHERE invitation_id=$2",
            [status, invitation.id],
          );
          if (i < 2 && index === 0) {
            const counts = { accepted: invitation.members.length, declined: 0, pending: 0 };
            await this.db.query(
              "INSERT INTO notifications(id,user_id,event_id,guest_name,message,counts,created_at) VALUES($1,$2,$3,$4,$5,$6,now()-($7 || ' minutes')::interval)",
              [
                randomUUID(),
                id,
                event.id,
                name,
                notificationMessage(counts, defaultLocale),
                JSON.stringify(counts),
                String(i * 25 + 8),
              ],
            );
          }
        }
      }
      return userView(row);
    } catch (e) {
      await this.db.query("DELETE FROM users WHERE id=$1", [id]);
      throw e;
    }
  }
}
