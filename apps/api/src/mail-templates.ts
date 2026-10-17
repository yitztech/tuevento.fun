import {
  translate,
  type Locale,
  type MessageKey,
  type MessageValues,
} from "@tuevento/contracts";
import type { MailMessage } from "./mail";

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

/** Estructura común: texto plano y HTML sencillo con estilos en línea (colores de DESIGN.md). */
function layout(options: {
  to: string;
  subject: string;
  site: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  footer: string;
}): MailMessage {
  const host = new URL(options.site).host;
  const text = [
    ...options.paragraphs,
    ...(options.action ? [`${options.action.label}: ${options.action.url}`] : []),
    "—",
    options.footer,
    options.site,
  ].join("\n\n");
  const button = options.action
    ? `<p style="margin:28px 0"><a href="${escape(options.action.url)}" style="background:#882d17;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;display:inline-block">${escape(options.action.label)}</a></p>
<p style="font-size:13px;color:#6e5f5a;word-break:break-all">${escape(options.action.url)}</p>`
    : "";
  const html = `<!doctype html>
<html><body style="margin:0;background:#fdf8f5;font-family:Helvetica,Arial,sans-serif;color:#261c18">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<p style="font-size:20px;font-weight:700;color:#882d17;margin:0 0 24px">TuEventoFun</p>
<div style="background:#ffffff;border:1px solid #efe6e1;border-radius:16px;padding:28px 24px;line-height:1.55">
${options.paragraphs.map((p) => `<p style="margin:0 0 14px">${escape(p)}</p>`).join("\n")}
${button}
</div>
<p style="font-size:12px;color:#6e5f5a;margin:20px 4px">${escape(options.footer)} · <a href="${escape(options.site)}" style="color:#6e5f5a">${escape(host)}</a></p>
</div></body></html>`;
  return { to: options.to, subject: options.subject, text, html };
}

export function passwordResetMail(
  locale: Locale,
  data: { to: string; name: string; url: string; site: string; minutes: number },
): MailMessage {
  const t = (key: MessageKey, values?: MessageValues) => translate(locale, key, values);
  return layout({
    to: data.to,
    site: data.site,
    subject: t("mail.passwordReset.subject"),
    paragraphs: [
      t("mail.greeting", { name: data.name }),
      t("mail.passwordReset.intro"),
      t("mail.passwordReset.expiry", { minutes: data.minutes }),
      t("mail.passwordReset.ignore"),
    ],
    action: { label: t("mail.passwordReset.action"), url: data.url },
    footer: t("mail.passwordReset.footer"),
  });
}

export function passwordChangedMail(
  locale: Locale,
  data: { to: string; name: string; site: string; resetUrl: string },
): MailMessage {
  const t = (key: MessageKey, values?: MessageValues) => translate(locale, key, values);
  return layout({
    to: data.to,
    site: data.site,
    subject: t("mail.passwordChanged.subject"),
    paragraphs: [
      t("mail.greeting", { name: data.name }),
      t("mail.passwordChanged.intro"),
      t("mail.passwordChanged.warning"),
    ],
    action: { label: t("mail.passwordChanged.action"), url: data.resetUrl },
    footer: t("mail.passwordChanged.footer"),
  });
}

/** Resumen en el correo del invitado tras guardar su respuesta. */
export function guestReplyMail(
  locale: Locale,
  data: {
    to: string;
    name: string;
    event: string;
    members: { name: string; status: string }[];
    url: string;
    site: string;
  },
): MailMessage {
  const t = (key: MessageKey, values?: MessageValues) => translate(locale, key, values);
  return layout({
    to: data.to,
    site: data.site,
    subject: t("mail.guestReply.subject", { event: data.event }),
    paragraphs: [
      t("mail.greeting", { name: data.name }),
      t("mail.guestReply.intro", { event: data.event }),
      ...data.members.map((m) => t("mail.guestReply.member", { name: m.name, status: m.status })),
      t("mail.guestReply.change"),
    ],
    action: { label: t("mail.openInvitation"), url: data.url },
    footer: t("mail.footer"),
  });
}

/** Aviso al organizador cuando alguien responde o se registra por su enlace genérico. */
export function ownerReplyMail(
  locale: Locale,
  data: {
    to: string;
    name: string;
    guest: string;
    event: string;
    counts: { accepted: number; declined: number; pending: number };
    url: string;
    site: string;
  },
): MailMessage {
  const t = (key: MessageKey, values?: MessageValues) => translate(locale, key, values);
  return layout({
    to: data.to,
    site: data.site,
    subject: t("mail.ownerReply.subject", { guest: data.guest, event: data.event }),
    paragraphs: [
      t("mail.greeting", { name: data.name }),
      t("mail.ownerReply.intro", { guest: data.guest, event: data.event }),
      t("mail.ownerReply.counts", data.counts),
    ],
    action: { label: t("mail.openEvent"), url: data.url },
    footer: t("mail.footer"),
  });
}

/** Aviso a un invitado cuando cambian la fecha o el lugar del evento. */
export function eventChangedMail(
  locale: Locale,
  data: {
    to: string;
    name: string;
    event: string;
    changes: string[];
    url: string;
    site: string;
  },
): MailMessage {
  const t = (key: MessageKey, values?: MessageValues) => translate(locale, key, values);
  return layout({
    to: data.to,
    site: data.site,
    subject: t("mail.eventChanged.subject", { event: data.event }),
    paragraphs: [
      t("mail.greeting", { name: data.name }),
      t("mail.eventChanged.intro", { event: data.event, changes: data.changes.join("; ") }),
    ],
    action: { label: t("mail.openInvitation"), url: data.url },
    footer: t("mail.footer"),
  });
}

/** Aviso a un invitado cuando el organizador cancela el evento. */
export function eventCancelledMail(
  locale: Locale,
  data: { to: string; name: string; event: string; url: string; site: string },
): MailMessage {
  const t = (key: MessageKey, values?: MessageValues) => translate(locale, key, values);
  return layout({
    to: data.to,
    site: data.site,
    subject: t("mail.eventCancelled.subject", { event: data.event }),
    paragraphs: [
      t("mail.greeting", { name: data.name }),
      t("mail.eventCancelled.intro", { event: data.event }),
    ],
    action: { label: t("mail.openInvitation"), url: data.url },
    footer: t("mail.footer"),
  });
}
