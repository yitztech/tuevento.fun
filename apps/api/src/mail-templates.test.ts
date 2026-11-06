import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { locales, sitePaletteIds, sitePalettes, type Locale } from "@tuevento/contracts";
import type { Database } from "./database";
import { MailService } from "./mail";
import { passwordResetMail, guestReplyMail } from "./mail-templates";

const reset = (locale: Locale) => passwordResetMail(locale, {
  to: "persona@example.invalid", name: "<María>", site: locale === "es" ? "https://tuevento.fun" : "https://yourevent.fun/pt",
  url: "https://tuevento.fun/reset?token=abc&x=1", minutes: 30,
});

test("El correo usa la paleta y logo localizado, conserva texto y escapa los datos", async () => {
  for (const locale of Object.keys(locales) as Locale[]) {
    for (const palette of sitePaletteIds) {
      const message = reset(locale);
      assert.ok(message.htmlForPalette);
      const html = message.htmlForPalette(palette);
      const logo = `/images/brand-v2/email/logo-${locale}-${palette}.png`;
      assert.ok(html.includes(logo));
      await access(`apps/web/public${logo}`);
      assert.ok(html.includes(palette === "terracotta" ? "#a63f30" : sitePalettes[palette].primary));
      assert.ok(html.includes("&lt;María&gt;"));
      assert.ok(!html.includes("<María>"));
      assert.ok(message.text.includes("<María>"));
      assert.ok(html.includes("token=abc&amp;x=1"));
    }
  }
});

test("El envío consulta la paleta vigente y conserva las cabeceras de baja", async () => {
  let palette = "indigo-ice";
  const db = { query: async () => [{ palette }] } as unknown as Database;
  const sent: { html: string; headers: Record<string, string> }[] = [];
  const mail = new MailService(db);
  Reflect.set(mail, "sender", () => ({ from: "sender@example.invalid", transport: { sendMail: async (message: typeof sent[number]) => { sent.push(message); } } }));
  const message = guestReplyMail("es", { to: "a@example.invalid", name: "Ana", event: "Fiesta", members: [], url: "https://tuevento.fun/evento", site: "https://tuevento.fun", unsubscribe: { page: "https://tuevento.fun/baja", oneClick: "https://tuevento.fun/api/mail/unsubscribe" } });
  await mail.send("es", message);
  palette = "forest-mint";
  await mail.send("es", message);
  assert.match(sent[0].html, /logo-es-indigo-ice\.png/);
  assert.match(sent[1].html, /logo-es-forest-mint\.png/);
  assert.equal(sent[1].headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
  assert.equal(sent[1].headers["Content-Language"], "es");
});
