import {
  translate,
  sitePalettes,
  type SitePaletteId,
  type Locale,
  type MessageKey,
  type MessageValues,
} from "@tuevento/contracts";
import type { MailMessage } from "./mail";

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

/** Enlaces para darse de baja de los avisos: la página (en el pie) y la baja en un clic (RFC 8058). */
export type Unsubscribe = { page: string; oneClick: string };

/** Estructura común: texto plano y HTML sencillo con estilos en línea (colores de DESIGN.md). */
function layout(options: {
  to: string;
  subject: string;
  site: string;
  locale: Locale;
  paragraphs: string[];
  action?: { label: string; url: string };
  footer: string;
  unsubscribe?: Unsubscribe & { label: string };
}): MailMessage {
  const host = new URL(options.site).host;
  const text = [
    ...options.paragraphs,
    ...(options.action ? [`${options.action.label}: ${options.action.url}`] : []),
    "—",
    options.footer,
    options.site,
    ...(options.unsubscribe ? [`${options.unsubscribe.label}: ${options.unsubscribe.page}`] : []),
  ].join("\n\n");
  const htmlForPalette = (palette: SitePaletteId) => {
  const colors = palette === "terracotta"
    ? { primary: "#a63f30", primaryText: "#ffffff", ink: "#3d2a25", muted: "#765f58", siteBg: "#fff6f2", line: "#f0d8cb" }
    : sitePalettes[palette];
  const logo = `${new URL(options.site).origin}/images/brand-v2/email/logo-${options.locale}-${palette}.png`;
  const unsubscribe = options.unsubscribe
    ? ` · <a href="${escapeHtml(options.unsubscribe.page)}" style="color:${colors.muted}">${escapeHtml(options.unsubscribe.label)}</a>`
    : "";
  const button = options.action
    ? `<p style="margin:28px 0"><a href="${escapeHtml(options.action.url)}" style="background:${colors.primary};color:${colors.primaryText};text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;display:inline-block">${escapeHtml(options.action.label)}</a></p>
<p style="font-size:13px;color:${colors.muted};word-break:break-all">${escapeHtml(options.action.url)}</p>`
    : "";
  const html = `<!doctype html>
<html><body style="margin:0;background:${colors.siteBg};font-family:Helvetica,Arial,sans-serif;color:${colors.ink}">
<div style="max-width:520px;margin:0 auto;padding:32px 24px">
<p style="margin:0 0 24px"><img src="${escapeHtml(logo)}" width="240" height="80" alt="TuEventoFun" style="display:block;width:240px;height:auto;max-width:100%;border:0"></p>
<div style="background:#ffffff;border:1px solid ${colors.line};border-radius:16px;padding:28px 24px;line-height:1.55">
${options.paragraphs.map((p) => `<p style="margin:0 0 14px">${escapeHtml(p)}</p>`).join("\n")}
${button}
</div>
<p style="font-size:12px;color:${colors.muted};margin:20px 4px">${escapeHtml(options.footer)} · <a href="${escapeHtml(options.site)}" style="color:${colors.muted}">${escapeHtml(host)}</a>${unsubscribe}</p>
</div></body></html>`;
  return html;
  };
  return {
    to: options.to,
    subject: options.subject,
    text,
    html: htmlForPalette("terracotta"),
    htmlForPalette,
    ...(options.unsubscribe
      ? {
          headers: {
            "List-Unsubscribe": `<${options.unsubscribe.oneClick}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }
      : {}),
  };
}

export function passwordResetMail(
  locale: Locale,
  data: { to: string; name: string; url: string; site: string; minutes: number },
): MailMessage {
  const t = (key: MessageKey, values?: MessageValues) => translate(locale, key, values);
  return layout({
    locale,
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
    locale,
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

export function verifyEmailMail(
  locale: Locale,
  data: { to: string; name: string; url: string; site: string; hours: number },
): MailMessage {
  const t = (key: MessageKey, values?: MessageValues) => translate(locale, key, values);
  return layout({
    locale,
    to: data.to,
    site: data.site,
    subject: t("mail.verifyEmail.subject"),
    paragraphs: [
      t("mail.greeting", { name: data.name }),
      t("mail.verifyEmail.intro"),
      t("mail.verifyEmail.expiry", { hours: data.hours }),
      t("mail.verifyEmail.ignore"),
    ],
    action: { label: t("mail.verifyEmail.action"), url: data.url },
    footer: t("mail.verifyEmail.footer"),
  });
}

/** Aviso al dueño: su cuenta se cerró un rato por demasiados intentos fallidos. */
export function loginLockedMail(
  locale: Locale,
  data: { to: string; name: string; site: string; resetUrl: string },
): MailMessage {
  const t = (key: MessageKey, values?: MessageValues) => translate(locale, key, values);
  return layout({
    locale,
    to: data.to,
    site: data.site,
    subject: t("mail.loginLocked.subject"),
    paragraphs: [
      t("mail.greeting", { name: data.name }),
      t("mail.loginLocked.intro"),
      t("mail.loginLocked.device"),
      t("mail.loginLocked.advice"),
    ],
    action: { label: t("mail.loginLocked.action"), url: data.resetUrl },
    footer: t("mail.loginLocked.footer"),
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
    unsubscribe: Unsubscribe;
  },
): MailMessage {
  const t = (key: MessageKey, values?: MessageValues) => translate(locale, key, values);
  return layout({
    locale,
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
    unsubscribe: { ...data.unsubscribe, label: t("mail.unsubscribe") },
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
    locale,
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
    unsubscribe: Unsubscribe;
  },
): MailMessage {
  const t = (key: MessageKey, values?: MessageValues) => translate(locale, key, values);
  return layout({
    locale,
    to: data.to,
    site: data.site,
    subject: t("mail.eventChanged.subject", { event: data.event }),
    paragraphs: [
      t("mail.greeting", { name: data.name }),
      t("mail.eventChanged.intro", { event: data.event, changes: data.changes.join("; ") }),
    ],
    action: { label: t("mail.openInvitation"), url: data.url },
    footer: t("mail.footer"),
    unsubscribe: { ...data.unsubscribe, label: t("mail.unsubscribe") },
  });
}

/** Aviso a un invitado cuando el organizador cancela el evento. */
export function eventCancelledMail(
  locale: Locale,
  data: { to: string; name: string; event: string; url: string; site: string; unsubscribe: Unsubscribe },
): MailMessage {
  const t = (key: MessageKey, values?: MessageValues) => translate(locale, key, values);
  return layout({
    locale,
    to: data.to,
    site: data.site,
    subject: t("mail.eventCancelled.subject", { event: data.event }),
    paragraphs: [
      t("mail.greeting", { name: data.name }),
      t("mail.eventCancelled.intro", { event: data.event }),
    ],
    action: { label: t("mail.openInvitation"), url: data.url },
    footer: t("mail.footer"),
    unsubscribe: { ...data.unsubscribe, label: t("mail.unsubscribe") },
  });
}
