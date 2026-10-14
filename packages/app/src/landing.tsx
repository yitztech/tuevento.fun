import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Heart,
  Menu,
  Play,
  Users,
  X,
} from "lucide-react";
import { themes, type Status } from "@tuevento/contracts";
import { Logo, InvitationArt } from "./components";
import { LanguageSwitcher, tr, useLocale } from "./i18n";
import { LegalLinks, legalPath } from "./legal";
import "./landing.css";

const family = [
  { name: "Ana", kind: "Adulto", initial: "accepted" },
  { name: "Leo", kind: "Niño", initial: "pending" },
  { name: "Luz", kind: "Adulto", initial: "accepted" },
] as const;

export function LandingPage() {
  const { locale } = useLocale();
  const [menu, setMenu] = useState(false);
  const [theme, setTheme] = useState<(typeof themes)[number]["id"]>("floral");
  const [answers, setAnswers] = useState<Status[]>(
    family.map((person) => person.initial),
  );
  const attending = answers.filter((status) => status === "accepted").length;
  const primary = "/registro?empezar=evento";
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [newsletterMessage, setNewsletterMessage] = useState("");
  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail) return;
    setNewsletterStatus("loading");
    setNewsletterMessage("");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-TuEvento-Client": "1",
        },
        body: JSON.stringify({ email: newsletterEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNewsletterStatus("success");
        setNewsletterMessage(data.message || tr("¡Gracias por suscribirte!"));
        setNewsletterEmail("");
      } else {
        setNewsletterStatus("error");
        setNewsletterMessage(
          data.message || tr("No se pudo completar la solicitud."),
        );
      }
    } catch {
      setNewsletterStatus("error");
      setNewsletterMessage(tr("No se pudo completar la solicitud."));
    }
  };
  const example = {
    title: tr("Una noche para recordar"),
    date: "2026-12-12T23:00:00Z",
    timeZone: "America/Mexico_City",
    location: tr("En nuestro lugar favorito"),
    theme,
  };
  useEffect(() => {
    document.title = tr("TuEventoFun · Invita, reúne y celebra");
    const meta = document.querySelector('meta[name="description"]');
    const previous = meta?.getAttribute("content");
    meta?.setAttribute(
      "content",
      tr(
        "Crea invitaciones con tu estilo, comparte un enlace privado y conoce quién asistirá a tu celebración, persona por persona.",
      ),
    );
    return () => {
      if (previous) meta?.setAttribute("content", previous);
    };
  }, [locale]);
  const closeMenu = () => setMenu(false);
  return (
    <div className="landing-page">
      <a className="skip-link" href="#landing-main">
        {tr("Saltar al contenido")}
      </a>
      <header className="landing-header">
        <div className="landing-container landing-header-inner">
          <Logo />
          <nav
            id="landing-navigation"
            className={menu ? "landing-nav open" : "landing-nav"}
            aria-label={tr("Navegación del sitio")}
          >
            <Link to="/descargas">{tr("Descargar la app")}</Link>
          <a href="#como-funciona" onClick={closeMenu}>
              {tr("Cómo funciona")}
            </a>
            <a href="#disenos" onClick={closeMenu}>
              {tr("Los diseños")}
            </a>
            <a href="#preguntas" onClick={closeMenu}>
              {tr("Preguntas frecuentes")}
            </a>
          </nav>
          <div className="landing-header-actions">
            <LanguageSwitcher />
            <Link className="landing-login" to="/acceso">
              {tr("Entrar")}
            </Link>
            <Link className="button landing-header-cta" to={primary}>
              {tr("Crear un evento")}
              <ArrowRight size={16} />
            </Link>
            <button
              className="icon-button landing-menu-button"
              aria-label={menu ? tr("Cerrar menú") : tr("Abrir menú")}
              aria-expanded={menu}
              aria-controls="landing-navigation"
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>
      <main id="landing-main">
        <section className="landing-container landing-hero">
          <div className="landing-hero-copy">
            <h1>{tr("Lo bonito es estar juntos.")}</h1>
            <p>
              {tr(
                "Invitaciones que ilusionan. Personas que hacen especial cada momento. Y una forma sencilla de reunirlas.",
              )}
            </p>
            <div className="landing-hero-actions">
              <Link className="button landing-primary" to={primary}>
                {tr("Crear mi primer evento")}
                <ArrowRight size={20} />
              </Link>
              <Link className="landing-demo-link" to="/app">
                <span>
                  <Play size={15} fill="currentColor" />
                </span>
                {tr("Ver la demostración")}
              </Link>
            </div>
            <p className="landing-hero-note">
              <CheckCircle2 size={17} />
              {tr("Tus invitados responden sin crear una cuenta.")}
            </p>
          </div>
          <div
            className="landing-photo-story"
            aria-label={tr("Momentos que merecen celebrarse")}
          >
            <img
              className="landing-photo-toast"
              src="/images/minimal.jpg"
              alt={tr("Amigos sonriendo mientras brindan juntos")}
              fetchPriority="high"
              width="1200"
              height="800"
            />
            <img
              className="landing-photo-wedding"
              src="/images/floral.jpg"
              alt={tr("Una pareja de recién casados con un ramo de flores")}
              width="1200"
              height="800"
            />
            <img
              className="landing-photo-balloons"
              src="/images/kids.jpg"
              alt={tr("Globos de colores preparados para una fiesta")}
              width="1200"
              height="800"
            />
            <div className="landing-photo-message">
              <span className="landing-photo-heart">
                <Heart size={21} />
              </span>
              <div>
                <strong>{tr("Que no falte tu gente.")}</strong>
                <span>{tr("Los recuerdos empiezan con una invitación.")}</span>
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="landing-container landing-how">
          <div className="landing-section-heading">
            <h2>{tr("Menos pendientes. Más momentos.")}</h2>
            <p>
              {tr(
                "Del primer “hay que vernos” al último abrazo, ten a mano lo que importa.",
              )}
            </p>
          </div>
          <ol className="landing-steps">
            {[
              [
                "Prepara algo especial",
                "Ponle nombre a tu celebración, elige un diseño y añade cuándo y dónde se reunirán.",
              ],
              [
                "Hazles llegar la ilusión",
                "Crea una invitación para cada persona o familia. Comparte su enlace por WhatsApp, correo o como prefieras.",
              ],
              [
                "Sabe quién viene",
                "Cada integrante confirma su respuesta. Tú ves la asistencia y las novedades en tu espacio.",
              ],
            ].map(([title, description], index) => (
              <li key={title}>
                <span className="landing-step-number" aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <h3>{tr(title)}</h3>
                  <p>{tr(description)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="disenos" className="landing-design-section">
          <div className="landing-container landing-design-layout">
            <div className="landing-design-copy">
              <h2>{tr("Una invitación tan especial como tu día.")}</h2>
              <p>
                {tr(
                  "Una boda entre flores, un cumpleaños con todos los colores o un brindis porque sí. Encuentra el estilo que se siente tuyo.",
                )}
              </p>
              <div
                className="landing-theme-choices"
                role="group"
                aria-label={tr("Elige un diseño de ejemplo")}
              >
                {themes.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    aria-pressed={theme === item.id}
                    onClick={() => setTheme(item.id)}
                    className={theme === item.id ? "selected" : ""}
                  >
                    <img
                      src={`/images/${item.image}`}
                      alt=""
                      loading="lazy"
                      width="64"
                      height="64"
                    />
                    <span>{tr(item.name)}</span>
                    {theme === item.id && <Check size={16} />}
                  </button>
                ))}
              </div>
              <Link
                className="button landing-primary"
                to={`/registro?tema=${theme}`}
              >
                {tr("Crear con este diseño")}
                <ArrowRight size={19} />
              </Link>
            </div>
            <figure className="landing-invitation-preview">
              <InvitationArt
                event={example}
                name={tr("Para tus personas favoritas")}
                large
              />
              <figcaption>
                {tr(
                  "Vista ilustrativa. Tu evento tendrá tus propios detalles.",
                )}
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="landing-container landing-people">
          <div className="landing-people-copy">
            <Users size={32} strokeWidth={1.5} />
            <h2>{tr("Cada persona cuenta. También dentro de una familia.")}</h2>
            <p>
              {tr(
                "Ana viene, Leo está por confirmar y Luz también se apunta. Cada respuesta tiene su lugar, para que prepares tu celebración con una idea clara de quién estará allí.",
              )}
            </p>
            <ul>
              <li>
                <CheckCircle2 size={18} />
                {tr("Invitaciones individuales y familiares")}
              </li>
              <li>
                <CheckCircle2 size={18} />
                {tr("Adultos y niños, persona por persona")}
              </li>
              <li>
                <CheckCircle2 size={18} />
                {tr("Respuestas y notificaciones en tu panel")}
              </li>
            </ul>
            <Link className="landing-text-link" to="/app">
              {tr("Explorar la demostración")}
              <ArrowRight size={19} />
            </Link>
          </div>
          <div className="landing-rsvp-demo">
            <div className="landing-rsvp-demo-heading">
              <div>
                <h3>{tr("Una familia, tres respuestas")}</h3>
                <p>{tr("Prueba este ejemplo de asistencia.")}</p>
              </div>
              <Heart size={23} />
            </div>
            <div className="landing-example-members">
              {family.map((person, index) => (
                <div className="landing-example-member" key={person.name}>
                  <div className="landing-example-member-name">
                    <strong>{person.name}</strong>
                    <span>{tr(person.kind)}</span>
                  </div>
                  <div
                    className="landing-example-options"
                    role="group"
                    aria-label={tr("Respuesta de {{name}}", {
                      name: person.name,
                    })}
                  >
                    {(["accepted", "pending", "declined"] as Status[]).map(
                      (status) => {
                        const Icon =
                          status === "accepted"
                            ? Check
                            : status === "pending"
                              ? Clock
                              : X;
                        const text =
                          status === "accepted"
                            ? "Asistiré"
                            : status === "pending"
                              ? "En espera"
                              : "No podré";
                        return (
                          <button
                            key={status}
                            type="button"
                            aria-pressed={answers[index] === status}
                            className={
                              answers[index] === status
                                ? `selected ${status}`
                                : ""
                            }
                            onClick={() =>
                              setAnswers((previous) =>
                                previous.map((answer, i) =>
                                  i === index ? status : answer,
                                ),
                              )
                            }
                          >
                            <Icon size={16} />
                            {tr(text)}
                          </button>
                        );
                      },
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="landing-example-count" role="status">
              <CheckCircle2 size={18} />
              {tr("{{count}} de 3 personas asistirán", { count: attending })}
            </p>
            <small>
              {tr(
                "Es una muestra interactiva; no se envían respuestas a ningún evento.",
              )}
            </small>
          </div>
        </section>

        <section id="preguntas" className="landing-container landing-faq">
          <div>
            <h2>{tr("Todo listo para dar el primer paso.")}</h2>
            <p>{tr("Algunas respuestas antes de empezar a celebrar.")}</p>
          </div>
          <div className="landing-faq-list">
            {[
              [
                "¿Mis invitados necesitan registrarse?",
                "No. Abren su enlace privado y responden por cada integrante de la invitación, sin crear una cuenta.",
              ],
              [
                "¿Puedo organizar más de un evento?",
                "Sí. Tu cuenta reúne tus eventos, sus listas de invitados y las respuestas de cada celebración.",
              ],
              [
                "¿Cómo envío las invitaciones?",
                "Cada invitación tiene un enlace privado. Puedes copiarlo o abrir un mensaje preparado para compartirlo por WhatsApp o correo.",
              ],
              [
                "¿Puedo cambiar el diseño y los detalles?",
                "Sí. Puedes editar la información del evento, elegir otro diseño y ajustar las personas de cada invitación desde tu espacio.",
              ],
            ].map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {tr(question)}
                  <ChevronDown size={18} />
                </summary>
                <p>{tr(answer)}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="landing-container landing-closing">
          <div className="landing-closing-copy">
            <Heart size={32} strokeWidth={1.5} />
            <h2>{tr("Tu próximo recuerdo empieza aquí.")}</h2>
            <p>
              {tr(
                "Tú pones el motivo. TuEventoFun te ayuda a reunir a las personas que lo hacen inolvidable.",
              )}
            </p>
            <Link className="button landing-primary" to={primary}>
              {tr("Empezar mi celebración")}
              <ArrowRight size={20} />
            </Link>
          </div>
          <img
            src="/images/gold.jpg"
            alt={tr(
              "Flores coloridas y copas sobre una mesa lista para recibir invitados",
            )}
            loading="lazy"
            width="1200"
            height="800"
          />
        </section>

        <section className="landing-container landing-newsletter">
          <div className="landing-newsletter-card">
            <div className="landing-newsletter-copy">
              <h2>{tr("Suscríbete a nuestra newsletter")}</h2>
              <p>{tr("Recibe ideas de celebraciones e invitaciones exclusivas.")}</p>
            </div>
            <form className="landing-newsletter-form" onSubmit={handleSubscribe}>
              <input
                type="email"
                required
                placeholder={tr("Correo electrónico")}
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                disabled={newsletterStatus === "loading"}
                aria-label={tr("Correo electrónico")}
              />
              <button
                type="submit"
                className="button landing-primary"
                disabled={newsletterStatus === "loading"}
              >
                {newsletterStatus === "loading" ? tr("Cargando…") : tr("Suscribirme")}
              </button>
            </form>
            <p className="landing-newsletter-legal">
              {tr("Te escribiremos en este idioma. Puedes darte de baja en cualquier momento.")}{" "}
              <Link to={legalPath("privacy", locale)}>{tr("Aviso de privacidad")}</Link>
            </p>
            {newsletterMessage && (
              <p className={`landing-newsletter-msg ${newsletterStatus}`} role="status">
                {newsletterMessage}
              </p>
            )}
          </div>
        </section>
      </main>
      <footer className="landing-footer landing-container">
        <div>
          <Logo />
          <p>{tr("Hecho para reunir a tus personas favoritas.")}</p>
        </div>
        <nav aria-label={tr("Enlaces del pie de página")}>
          <Link to="/acceso">{tr("Entrar a mi espacio")}</Link>
          <Link to="/app">{tr("Explorar la demostración")}</Link>
          <a href="#preguntas">{tr("Preguntas frecuentes")}</a>
          <LegalLinks className="landing-legal-links" />
        </nav>
        <small>© {new Date().getFullYear()} TuEventoFun</small>
      </footer>
    </div>
  );
}
