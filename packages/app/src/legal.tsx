import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  localizedPage,
  localizedPaths,
  type Locale,
  type LocalizedPage,
} from "@tuevento/contracts";
import { Logo, Container } from "./components";
import { LanguageSwitcher, useLocale } from "./i18n";

/**
 * Titular del servicio, domicilio y canal de contacto para privacidad. No se inventan:
 * lo que sea null se indica en la página sin dar datos falsos. El domicilio está
 * incompleto a propósito (ciudad, estado y país) hasta tener el definitivo.
 */
export const LEGAL_OWNER: {
  name: string | null;
  address: Record<Locale, string> | null;
  contact: string | null;
} = {
  name: "YunitzTech",
  address: { es: "Cuernavaca, Morelos, México", en: "Cuernavaca, Morelos, Mexico" },
  contact: "contacto@tuevento.fun",
};
/** Fecha de la última revisión del texto (AAAA-MM-DD). */
export const LEGAL_UPDATED = "2026-10-14";

export type LegalKind = Extract<LocalizedPage, "privacy" | "terms">;
export function legalPageFor(pathname: string): LegalKind | null {
  const page = localizedPage(pathname);
  return page === "privacy" || page === "terms" ? page : null;
}
/** Ruta de la página legal en el idioma del dominio actual. */
export const legalPath = (kind: LegalKind, locale: Locale) =>
  localizedPaths[kind][locale];

type Section = { title: string; body: string[] };
/** Enlaza el correo de contacto (no los remitentes no-reply) con mailto. */
const withMailLinks = (text: string) => {
  const mail = LEGAL_OWNER.contact;
  if (!mail?.includes("@") || !text.includes(mail)) return text;
  return text.split(mail).flatMap((part, i) =>
    i
      ? [
          <a key={i} href={`mailto:${mail}`}>
            {mail}
          </a>,
          part,
        ]
      : [part],
  );
};
type Content = { title: string; intro: string; sections: Section[] };

const owner = (locale: Locale) => {
  const missing =
    locale === "es"
      ? "pendiente de publicar en esta página"
      : "to be published on this page";
  return {
    name: LEGAL_OWNER.name ?? missing,
    address: LEGAL_OWNER.address?.[locale] ?? missing,
    contact: LEGAL_OWNER.contact ?? missing,
  };
};

function privacy(locale: Locale): Content {
  const o = owner(locale);
  if (locale === "en")
    return {
      title: "Privacy policy",
      intro:
        "This policy explains what information TuEventoFun handles to let you create events, send private invitations and track who will attend.",
      sections: [
        {
          title: "Who is responsible",
          body: [
            `Service owner: ${o.name}.`,
            `Address: ${o.address}.`,
            `Privacy contact: ${o.contact}.`,
          ],
        },
        {
          title: "Information about your account",
          body: [
            "When you sign up we store your first and last name, email, phone number, username and a password protected with scrypt (we never store it in plain text). We also store the language of the domain you use to sign in: tuevento.fun for Spanish and yourevent.fun for English. We write to you in that language and from that domain.",
            "If you upload an avatar or logo, we resize it to 256 × 256 pixels and keep only that copy.",
            "If you sign in with Google, we receive and verify your name, email and Google account identifier. We do not receive your Google password.",
          ],
        },
        {
          title: "What we use your information for",
          body: [
            "To provide the service you ask for: create and keep your account, let you sign in and recover access, save your events and invitations, show each guest their invitation, record their replies and notify you. We also use it to keep the service secure and prevent abuse.",
            "Only if you subscribe to the newsletter: to send you ideas and news about TuEventoFun. This purpose is optional; not subscribing, or unsubscribing, does not affect your account.",
          ],
        },
        {
          title: "Information about your guests",
          body: [
            "For each event you can add invitations with a name, email, phone number and private notes, as well as each member's name, whether they are an adult or a child, and notes. Notes and contact details are only visible to you; the invitation page shows guests only their names and the event details.",
            "Guests reply without creating an account. We store each member's answer (attending, not attending or pending) and notify you.",
            "You are responsible for having your guests' permission to add their details.",
          ],
        },
        {
          title: "Sessions and storage on your device",
          body: [
            "We use a session cookie that cannot be read by scripts (HttpOnly) and lasts 7 days, and a temporary cookie of 5 minutes to verify Google sign-in. We do not use advertising cookies.",
            "On the mobile apps, the language you choose is saved on your device.",
            "To count visits, the browser keeps an anonymous random identifier. We record the page type (home, downloads or panel), the platform (web, Android or iOS) and the date. We do not record your IP address, invitation links or contact details in these metrics.",
            "If analytics with Umami is enabled on this site, the page also loads its script to measure visits in aggregate.",
            "Like any website, our servers keep technical access logs, which include the IP address, for security and operation.",
          ],
        },
        {
          title: "Emails we send you",
          body: [
            "If you ask to reset your password, we email you a link that works once and expires in 60 minutes; we only keep a fingerprint (hash) of that link. When the password changes, we sign out every open session and send you a security notice.",
            "These emails are sent in the language of the domain you used, from that domain (no-reply@tuevento.fun or no-reply@yourevent.fun), through an email delivery provider that only receives what is needed to deliver them.",
          ],
        },
        {
          title: "Newsletter",
          body: [
            "The newsletter is optional and separate from your account. If you subscribe, we keep your email, the name you give us and the language of the domain where you subscribed.",
            "It is managed with Listmonk, our own mailing tool, on news.tuevento.fun for Spanish and news.yourevent.fun for English. You will receive an email to confirm your subscription, and every newsletter includes a link to unsubscribe at any time.",
          ],
        },
        {
          title: "Where information is stored and for how long",
          body: [
            "Data is stored in a PostgreSQL database on the service's servers.",
            "Your events, invitations and replies remain until you delete them. Deleting an event or an invitation also deletes its guests and replies.",
            "Visit and access records are deleted after 90 days. Demonstration spaces are deleted after 7 days. Expired sessions and password reset links are deleted automatically.",
            "Newsletter subscriptions are kept until you unsubscribe or ask us to delete them.",
          ],
        },
        {
          title: "Sharing with others",
          body: [
            "We do not sell or rent your information. When you share an invitation by WhatsApp or email, it is sent from your own app or email client, under their terms.",
            "Google takes part only if you choose to sign in with Google.",
            "To deliver our emails we use an email delivery provider, which acts on our behalf and may not use your information for anything else.",
          ],
        },
        {
          title: "Mobile apps",
          body: [
            "The Android and iOS apps use the same account and the same information described here.",
          ],
        },
        {
          title: "Your rights",
          body: [
            "You can view and correct your profile from your account at any time, and delete your events and invitations.",
            `To access, correct or delete your information, object to its use, withdraw your consent or close your account, write to the privacy contact: ${o.contact}. Tell us your account email and what you need; we will reply within the time limits set by Mexican law.`,
          ],
        },
        {
          title: "Changes to this policy",
          body: [
            "If this policy changes, we will publish the new version on this page with its date.",
          ],
        },
      ],
    };
  return {
    title: "Aviso de privacidad",
    intro:
      "Este aviso explica qué información trata TuEventoFun para que puedas crear eventos, enviar invitaciones privadas y saber quién asistirá.",
    sections: [
      {
        title: "Quién es responsable",
        body: [
          `Titular del servicio: ${o.name}.`,
          `Domicilio: ${o.address}.`,
          `Contacto de privacidad: ${o.contact}.`,
        ],
      },
      {
        title: "Información de tu cuenta",
        body: [
          "Al registrarte guardamos tu nombre y apellidos, correo, teléfono, nombre de usuario y una contraseña protegida con scrypt (nunca la guardamos en texto plano). También guardamos el idioma del dominio por el que entras: tuevento.fun para español y yourevent.fun para inglés. Te escribimos en ese idioma y desde ese dominio.",
          "Si subes un avatar o logo, lo reducimos a 256 × 256 píxeles y solo conservamos esa copia.",
          "Si entras con Google, recibimos y verificamos tu nombre, correo e identificador de cuenta de Google. No recibimos tu contraseña de Google.",
        ],
      },
      {
        title: "Para qué usamos tu información",
        body: [
          "Para darte el servicio que pides: crear y mantener tu cuenta, permitirte entrar y recuperar el acceso, guardar tus eventos e invitaciones, mostrar a cada invitado su invitación, registrar sus respuestas y avisarte. También la usamos para mantener la seguridad del servicio y evitar abusos.",
          "Solo si te suscribes a la newsletter: para enviarte ideas y novedades de TuEventoFun. Esta finalidad es opcional; no suscribirte, o darte de baja, no afecta a tu cuenta.",
        ],
      },
      {
        title: "Información de tus invitados",
        body: [
          "En cada evento puedes añadir invitaciones con nombre, correo, teléfono y notas privadas, además del nombre de cada integrante, si es adulto o niño y sus notas. Las notas y los datos de contacto solo los ves tú; la página de invitación muestra a los invitados únicamente sus nombres y los datos del evento.",
          "Los invitados responden sin crear una cuenta. Guardamos la respuesta de cada integrante (confirmado, no asistirá o en espera) y te avisamos.",
          "Eres responsable de contar con el permiso de tus invitados para añadir sus datos.",
        ],
      },
      {
        title: "Sesiones y almacenamiento en tu dispositivo",
        body: [
          "Usamos una cookie de sesión que no pueden leer los scripts (HttpOnly) y dura 7 días, y una cookie temporal de 5 minutos para verificar el acceso con Google. No usamos cookies publicitarias.",
          "En las apps móviles, el idioma que eliges se guarda en tu dispositivo.",
          "Para contar visitas, el navegador conserva un identificador aleatorio anónimo. Registramos el tipo de página (inicio, descargas o panel), la plataforma (web, Android o iOS) y la fecha. No registramos tu dirección IP, enlaces de invitación ni datos de contacto en estas métricas.",
          "Si en este sitio está activada la analítica con Umami, la página también carga su script para medir visitas de forma agregada.",
          "Como cualquier sitio web, nuestros servidores guardan registros técnicos de acceso, que incluyen la dirección IP, por seguridad y funcionamiento.",
        ],
      },
      {
        title: "Correos que te enviamos",
        body: [
          "Si pides restablecer tu contraseña, te enviamos un enlace que funciona una sola vez y caduca en 60 minutos; solo guardamos una huella (hash) de ese enlace. Cuando la contraseña cambia, cerramos todas las sesiones abiertas y te enviamos un aviso de seguridad.",
          "Estos correos se envían en el idioma del dominio que usaste, desde ese dominio (no-reply@tuevento.fun o no-reply@yourevent.fun), a través de un proveedor de envío de correo que solo recibe lo necesario para entregarlos.",
        ],
      },
      {
        title: "Newsletter",
        body: [
          "La newsletter es opcional e independiente de tu cuenta. Si te suscribes, guardamos tu correo, el nombre que nos des y el idioma del dominio donde te suscribiste.",
          "La gestionamos con Listmonk, una herramienta de envío propia, en news.tuevento.fun para español y news.yourevent.fun para inglés. Recibirás un correo para confirmar la suscripción, y cada envío incluye un enlace para darte de baja en cualquier momento.",
        ],
      },
      {
        title: "Dónde se guarda y durante cuánto tiempo",
        body: [
          "Los datos se guardan en una base de datos PostgreSQL en los servidores del servicio.",
          "Tus eventos, invitaciones y respuestas se conservan hasta que los eliminas. Eliminar un evento o una invitación borra también sus invitados y respuestas.",
          "Los registros de visitas y accesos se borran a los 90 días. Los espacios de demostración se borran a los 7 días. Las sesiones y los enlaces de recuperación caducados se eliminan automáticamente.",
          "Las suscripciones a la newsletter se conservan hasta que te das de baja o nos pides borrarlas.",
        ],
      },
      {
        title: "Con quién se comparte",
        body: [
          "No vendemos ni alquilamos tu información. Cuando compartes una invitación por WhatsApp o correo, se envía desde tu propia aplicación o cliente de correo, con sus condiciones.",
          "Google solo interviene si eliges entrar con Google.",
          "Para entregar nuestros correos usamos un proveedor de envío de correo, que actúa por cuenta nuestra y no puede usar tu información para otra cosa.",
        ],
      },
      {
        title: "Apps móviles",
        body: [
          "Las apps de Android e iOS usan la misma cuenta y la misma información descrita aquí.",
        ],
      },
      {
        title: "Tus derechos",
        body: [
          "Puedes ver y corregir tu perfil desde tu cuenta en cualquier momento, y eliminar tus eventos e invitaciones.",
          `Para ejercer tus derechos de acceso, rectificación, cancelación u oposición (ARCO), revocar tu consentimiento o cerrar tu cuenta, escribe al contacto de privacidad: ${o.contact}. Indica el correo de tu cuenta y lo que necesitas; te responderemos en los plazos que marca la ley mexicana.`,
        ],
      },
      {
        title: "Cambios a este aviso",
        body: [
          "Si este aviso cambia, publicaremos la nueva versión en esta página con su fecha.",
        ],
      },
    ],
  };
}

function terms(locale: Locale): Content {
  const o = owner(locale);
  if (locale === "en")
    return {
      title: "Terms of use",
      intro:
        "These terms apply when you use TuEventoFun on the web or in its mobile apps.",
      sections: [
        {
          title: "The service",
          body: [
            "TuEventoFun lets you create events, design invitations, share private links and track replies person by person. It is offered by " +
              `${o.name}, based in ${o.address}.`,
          ],
        },
        {
          title: "Your account",
          body: [
            "You must provide truthful information and keep your password safe. You are responsible for the activity on your account.",
            "If you forget your password, you can ask for a link to choose a new one; it is sent to your account email.",
            "Each invitation link is private: anyone who has it can see the invitation and reply. Share it only with your guests.",
          ],
        },
        {
          title: "Your content and your guests",
          body: [
            "The events, texts and images you add are yours. You allow us to store and display them only to provide the service.",
            "You must have your guests' permission to add their details, and use the service only to organize real celebrations, without sending unwanted messages.",
          ],
        },
        {
          title: "Acceptable use",
          body: [
            "Do not use the service for illegal content, to impersonate others or to try to access other people's accounts or data. We may suspend accounts that do.",
          ],
        },
        {
          title: "Availability",
          body: [
            "We work to keep the service available, but we cannot guarantee it will work without interruptions. Demonstration spaces are temporary and are deleted after 7 days.",
          ],
        },
        {
          title: "Changes and contact",
          body: [
            "If these terms change, we will publish the new version on this page with its date.",
            `Contact: ${o.contact}.`,
          ],
        },
      ],
    };
  return {
    title: "Condiciones de uso",
    intro:
      "Estas condiciones se aplican cuando usas TuEventoFun en la web o en sus apps móviles.",
    sections: [
      {
        title: "El servicio",
        body: [
          "TuEventoFun te permite crear eventos, diseñar invitaciones, compartir enlaces privados y conocer las respuestas persona por persona. Lo ofrece " +
            `${o.name}, con domicilio en ${o.address}.`,
        ],
      },
      {
        title: "Tu cuenta",
        body: [
          "Debes dar información verdadera y cuidar tu contraseña. Eres responsable de la actividad de tu cuenta.",
          "Si olvidas tu contraseña, puedes pedir un enlace para elegir una nueva; llega al correo de tu cuenta.",
          "Cada enlace de invitación es privado: quien lo tenga puede ver la invitación y responder. Compártelo solo con tus invitados.",
        ],
      },
      {
        title: "Tu contenido y tus invitados",
        body: [
          "Los eventos, textos e imágenes que añades son tuyos. Nos permites guardarlos y mostrarlos solo para prestar el servicio.",
          "Debes contar con el permiso de tus invitados para añadir sus datos, y usar el servicio solo para organizar celebraciones reales, sin enviar mensajes no deseados.",
        ],
      },
      {
        title: "Uso aceptable",
        body: [
          "No uses el servicio para contenido ilegal, para suplantar a otras personas ni para intentar acceder a cuentas o datos ajenos. Podemos suspender las cuentas que lo hagan.",
        ],
      },
      {
        title: "Disponibilidad",
        body: [
          "Trabajamos para que el servicio esté disponible, pero no podemos garantizar que funcione sin interrupciones. Los espacios de demostración son temporales y se borran a los 7 días.",
        ],
      },
      {
        title: "Cambios y contacto",
        body: [
          "Si estas condiciones cambian, publicaremos la nueva versión en esta página con su fecha.",
          `Contacto: ${o.contact}.`,
        ],
      },
    ],
  };
}

export function LegalPage({ page }: { page: LegalKind }) {
  const { locale } = useLocale();
  const content = page === "privacy" ? privacy(locale) : terms(locale);
  const other: LegalKind = page === "privacy" ? "terms" : "privacy";
  useEffect(() => {
    document.title = `${content.title} · TuEventoFun`;
  }, [content.title]);
  const updated = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${LEGAL_UPDATED}T00:00:00Z`));
  return (
    <div className="legal-page">
      <Container width="prose">
        <header>
          <Logo />
          <LanguageSwitcher />
        </header>
        <main>
          <Link to="/" className="text-link">
            <ArrowLeft size={16} />
            {locale === "en" ? "Back to home" : "Volver al inicio"}
          </Link>
          <h1>{content.title}</h1>
          <p className="legal-updated">
            {locale === "en" ? "Last updated: " : "Última actualización: "}
            {updated}
          </p>
          <p className="legal-intro">{content.intro}</p>
          {content.sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.body.map((text) => (
                <p key={text}>{withMailLinks(text)}</p>
              ))}
            </section>
          ))}
          <p className="legal-other">
            <Link to={legalPath(other, locale)}>
              {other === "privacy"
                ? locale === "en"
                  ? "Privacy policy"
                  : "Aviso de privacidad"
                : locale === "en"
                  ? "Terms of use"
                  : "Condiciones de uso"}
            </Link>
          </p>
        </main>
      </Container>
    </div>
  );
}
/** Enlaces a las páginas legales en el idioma del dominio, para pies y formularios. */
export function LegalLinks({ className }: { className?: string }) {
  const { locale } = useLocale();
  return (
    <span className={className}>
      <Link to={legalPath("privacy", locale)}>
        {locale === "en" ? "Privacy" : "Privacidad"}
      </Link>
      <Link to={legalPath("terms", locale)}>
        {locale === "en" ? "Terms" : "Condiciones"}
      </Link>
    </span>
  );
}
/** Aviso legal bajo los formularios de registro y acceso. */
export function AuthLegalNotice({ registerMode }: { registerMode: boolean }) {
  const { locale } = useLocale();
  const privacyLink = (
    <Link to={legalPath("privacy", locale)}>
      {locale === "en" ? "Privacy policy" : "Aviso de privacidad"}
    </Link>
  );
  const termsLink = (
    <Link to={legalPath("terms", locale)}>
      {locale === "en" ? "Terms of use" : "Condiciones de uso"}
    </Link>
  );
  if (!registerMode)
    return (
      <p className="auth-legal">
        {termsLink} · {privacyLink}
      </p>
    );
  return locale === "en" ? (
    <p className="auth-legal">
      By creating your account you accept the {termsLink} and the {privacyLink}.
    </p>
  ) : (
    <p className="auth-legal">
      Al crear tu cuenta aceptas las {termsLink} y el {privacyLink}.
    </p>
  );
}
