import type { Locale } from "@tuevento/contracts";
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
  return locale === "en"
    ? layout({
        to: data.to,
        site: data.site,
        subject: "Reset your TuEventoFun password",
        paragraphs: [
          `Hi ${data.name},`,
          "We received a request to reset the password for your account. Use the button below to choose a new one.",
          `The link works once and expires in ${data.minutes} minutes.`,
          "If you didn't ask for this, you can ignore this email: your password won't change.",
        ],
        action: { label: "Choose a new password", url: data.url },
        footer: "You received this email because someone asked to reset the password of your account.",
      })
    : layout({
        to: data.to,
        site: data.site,
        subject: "Restablece tu contraseña de TuEventoFun",
        paragraphs: [
          `Hola, ${data.name}:`,
          "Recibimos una solicitud para restablecer la contraseña de tu cuenta. Usa el botón para elegir una nueva.",
          `El enlace funciona una sola vez y caduca en ${data.minutes} minutos.`,
          "Si no lo pediste tú, ignora este correo: tu contraseña no cambiará.",
        ],
        action: { label: "Elegir una contraseña nueva", url: data.url },
        footer: "Recibes este correo porque alguien pidió restablecer la contraseña de tu cuenta.",
      });
}

export function passwordChangedMail(
  locale: Locale,
  data: { to: string; name: string; site: string; resetUrl: string },
): MailMessage {
  return locale === "en"
    ? layout({
        to: data.to,
        site: data.site,
        subject: "Your TuEventoFun password was changed",
        paragraphs: [
          `Hi ${data.name},`,
          "The password for your account was just changed, and every open session was signed out.",
          "If it wasn't you, reset your password right away.",
        ],
        action: { label: "Reset my password", url: data.resetUrl },
        footer: "Security notice about your account.",
      })
    : layout({
        to: data.to,
        site: data.site,
        subject: "Cambiaste tu contraseña de TuEventoFun",
        paragraphs: [
          `Hola, ${data.name}:`,
          "La contraseña de tu cuenta acaba de cambiar y cerramos todas las sesiones abiertas.",
          "Si no fuiste tú, restablece tu contraseña de inmediato.",
        ],
        action: { label: "Restablecer mi contraseña", url: data.resetUrl },
        footer: "Aviso de seguridad sobre tu cuenta.",
      });
}
