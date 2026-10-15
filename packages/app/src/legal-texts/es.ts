import type { LegalTexts } from "./types";

/** Aviso de privacidad y condiciones de uso en español. */
export const es: LegalTexts = {
  missing: "pendiente de publicar en esta página",
  address: "Cuernavaca, Morelos, México",
  privacy: (o) => ({
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
  }),
  terms: (o) => ({
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
  }),
};
