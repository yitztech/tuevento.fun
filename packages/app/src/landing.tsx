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
  Store,
} from "lucide-react";
import { themes, type MessageKey, type Status } from "@tuevento/contracts";
import { Logo, InvitationArt } from "./components";
import { themeImageSrcSet } from "./theme-images";
import { LanguageSwitcher, tr, useLocale } from "./i18n";
import { LegalLinks, legalPath } from "./legal";
import { pricingPath } from "./pricing";
import "./landing.css";

const family = [
  { name: "Ana", kind: "common.adult", initial: "accepted" },
  { name: "Leo", kind: "common.child", initial: "pending" },
  { name: "Luz", kind: "common.adult", initial: "accepted" },
] as const;

const steps: [MessageKey, MessageKey][] = [
  [
    "landing.planSomethingSpecial",
    "landing.giveCelebrationNameChoose",
  ],
  [
    "landing.shareExcitement",
    "landing.createInvitationEachPerson",
  ],
  [
    "landing.knowWhoComing",
    "landing.eachPersonConfirmsTheir",
  ],
];
const faq: [MessageKey, MessageKey][] = [
  [
    "landing.doGuestsNeedSign",
    "landing.noTheyOpenTheir",
  ],
  [
    "landing.organizeMoreThanOne",
    "landing.yesAccountBringsTogether",
  ],
  [
    "landing.howDoSendInvitations",
    "landing.eachInvitationHasPrivate",
  ],
  [
    "landing.changeDesignDetails",
    "landing.yesEditEventInformation",
  ],
];

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
        setNewsletterMessage(data.message || tr("newsletter.thanks"));
        setNewsletterEmail("");
      } else {
        setNewsletterStatus("error");
        setNewsletterMessage(
          data.message || tr("common.couldntCompleteRequest"),
        );
      }
    } catch {
      setNewsletterStatus("error");
      setNewsletterMessage(tr("common.couldntCompleteRequest"));
    }
  };
  const example = {
    title: tr("landing.nightRemember"),
    date: "2026-12-12T23:00:00Z",
    timeZone: "America/Mexico_City",
    location: tr("landing.favoritePlace"),
    theme,
  };
  useEffect(() => {
    document.title = tr("landing.tueventofunInviteGatherCelebrate");
    const meta = document.querySelector('meta[name="description"]');
    const previous = meta?.getAttribute("content");
    meta?.setAttribute(
      "content",
      tr(
        "common.metaDescription",
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
        {tr("common.skipContent")}
      </a>
      <header className="landing-header">
        <div className="landing-container landing-header-inner">
          <Logo />
          <nav
            id="landing-navigation"
            className={menu ? "landing-nav open" : "landing-nav"}
            aria-label={tr("landing.siteNavigation")}
          >
            <Link to="/descargas">{tr("landing.downloadApp")}</Link>
          <a href="#como-funciona" onClick={closeMenu}>
              {tr("landing.howWorks")}
            </a>
            <a href="#disenos" onClick={closeMenu}>
              {tr("landing.designs")}
            </a>
            <a href="#preguntas" onClick={closeMenu}>
              {tr("landing.frequentlyAskedQuestions")}
            </a>
            <Link to={pricingPath(locale)} onClick={closeMenu}>
              {tr("pricing.title")}
            </Link>
          </nav>
          <div className="landing-header-actions">
            <LanguageSwitcher />
            <Link className="landing-login" to="/acceso">
              {tr("landing.logIn")}
            </Link>
            <Link className="button landing-header-cta" to={primary}>
              {tr("landing.createEvent")}
              <ArrowRight size={16} />
            </Link>
            <button
              className="icon-button landing-menu-button"
              aria-label={menu ? tr("common.closeMenu") : tr("common.openMenu")}
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
            <h1>{tr("landing.joyBeingTogether")}</h1>
            <p>
              {tr(
                "landing.invitationsSparkExcitementPeople",
              )}
            </p>
            <div className="landing-hero-actions">
              <Link className="button landing-primary" to={primary}>
                {tr("common.createFirstEvent")}
                <ArrowRight size={20} />
              </Link>
              <Link className="landing-demo-link" to="/registro">
                <span>
                  <Play size={15} fill="currentColor" />
                </span>
                {tr("landing.exploreDemo")}
              </Link>
            </div>
            <p className="landing-hero-note">
              <CheckCircle2 size={17} />
              {tr("landing.guestsReplyWithoutCreating")}
            </p>
          </div>
          <div
            className="landing-photo-story"
            aria-label={tr("landing.momentsWorthCelebrating")}
          >
            <img
              className="landing-photo-toast"
              src="/images/minimal.jpg"
              alt={tr("landing.friendsSmilingTheyRaise")}
              fetchPriority="high"
              width="1200"
              height="800"
            />
            <img
              className="landing-photo-wedding"
              src="/images/floral.jpg"
              alt={tr("landing.newlyMarriedCoupleBouquet")}
              width="1200"
              height="800"
            />
            <img
              className="landing-photo-balloons"
              src="/images/kids.jpg"
              alt={tr("landing.colorfulBalloonsReadyParty")}
              width="1200"
              height="800"
            />
            <div className="landing-photo-message">
              <span className="landing-photo-heart">
                <Heart size={21} />
              </span>
              <div>
                <strong>{tr("landing.bringFavoritePeople")}</strong>
                <span>{tr("landing.memoriesBeginInvitation")}</span>
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="landing-container landing-how">
          <div className="landing-section-heading">
            <h2>{tr("landing.lessPlanningStressMore")}</h2>
            <p>
              {tr(
                "landing.fromFirstLetsGet",
              )}
            </p>
          </div>
          <ol className="landing-steps">
            {steps.map(([title, description], index) => (
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
              <h2>{tr("landing.invitationSpecialDay")}</h2>
              <p>
                {tr(
                  "landing.weddingAmongFlowersBirthday",
                )}
              </p>
              <div
                className="landing-theme-choices"
                role="group"
                aria-label={tr("landing.chooseSampleDesign")}
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
                      srcSet={themeImageSrcSet(item)}
                      sizes="64px"
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
                {tr("landing.createDesign")}
                <ArrowRight size={19} />
              </Link>
            </div>
            <figure className="landing-invitation-preview">
              <InvitationArt
                event={example}
                name={tr("landing.favoritePeople")}
                large
              />
              <figcaption>
                {tr(
                  "landing.samplePreviewEventHave",
                )}
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="landing-container landing-people">
          <div className="landing-people-copy">
            <Users size={32} strokeWidth={1.5} />
            <h2>{tr("landing.everyPersonCountsWithin")}</h2>
            <p>
              {tr(
                "landing.anaComingLeoStill",
              )}
            </p>
            <ul>
              <li>
                <CheckCircle2 size={18} />
                {tr("landing.individualFamilyInvitations")}
              </li>
              <li>
                <CheckCircle2 size={18} />
                {tr("landing.adultsChildrenOnePerson")}
              </li>
              <li>
                <CheckCircle2 size={18} />
                {tr("landing.repliesNotificationsDashboard")}
              </li>
            </ul>
            <Link className="landing-text-link" to="/registro">
              {tr("common.exploreDemo")}
              <ArrowRight size={19} />
            </Link>
          </div>
          <div className="landing-rsvp-demo">
            <div className="landing-rsvp-demo-heading">
              <div>
                <h3>{tr("landing.oneFamilyThreeReplies")}</h3>
                <p>{tr("landing.tryAttendanceExample")}</p>
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
                    aria-label={tr("landing.replyFromName", {
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
                            ? "landing.attending"
                            : status === "pending"
                              ? "status.pending"
                              : "landing.notAttending";
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
              {tr("landing.count3PeopleAttending", { count: attending })}
            </p>
            <small>
              {tr(
                "landing.interactiveExampleNoReplies",
              )}
            </small>
          </div>
        </section>

        <section id="preguntas" className="landing-container landing-faq">
          <div>
            <h2>{tr("landing.readyTakeFirstStep")}</h2>
            <p>{tr("landing.fewAnswersBeforeCelebration")}</p>
          </div>
          <div className="landing-faq-list">
            {faq.map(([question, answer]) => (
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
            <h2>{tr("landing.nextMemoryStartsHere")}</h2>
            <p>
              {tr(
                "landing.bringOccasionTueventofunHelps",
              )}
            </p>
            <Link className="button landing-primary" to={primary}>
              {tr("landing.startCelebration")}
              <ArrowRight size={20} />
            </Link>
          </div>
          <img
            src="/images/gold.jpg"
            alt={tr(
              "landing.colorfulFlowersGlassesTable",
            )}
            loading="lazy"
            width="1200"
            height="800"
          />
        </section>

        <section className="landing-container landing-providers" aria-labelledby="landing-providers-title">
          <div className="landing-newsletter-card">
            <div className="landing-newsletter-copy">
              <Store size={28} strokeWidth={1.5} />
              <h2 id="landing-providers-title">{tr("landing.providersTitle")}</h2>
              <p>{tr("landing.providersText")}</p>
            </div>
            <Link className="button landing-primary" to="/registro?tipo=proveedor">
              {tr("landing.providersAction")}
              <ArrowRight size={20} />
            </Link>
          </div>
        </section>

        <section className="landing-container landing-newsletter">
          <div className="landing-newsletter-card">
            <div className="landing-newsletter-copy">
              <h2>{tr("landing.subscribeNewsletter")}</h2>
              <p>{tr("landing.getCelebrationIdeasExclusive")}</p>
            </div>
            <form className="landing-newsletter-form" onSubmit={handleSubscribe}>
              <input
                type="email"
                required
                placeholder={tr("common.email")}
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                disabled={newsletterStatus === "loading"}
                aria-label={tr("common.email")}
              />
              <button
                type="submit"
                className="button landing-primary"
                disabled={newsletterStatus === "loading"}
              >
                {newsletterStatus === "loading" ? tr("common.loadingEllipsis") : tr("landing.subscribe")}
              </button>
            </form>
            <p className="landing-newsletter-legal">
              {tr("landing.wellWriteLanguageUnsubscribe")}{" "}
              <Link to={legalPath("privacy", locale)}>{tr("legal.privacyPolicy")}</Link>
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
          <p>{tr("common.madeBringFavoritePeople")}</p>
        </div>
        <nav aria-label={tr("landing.footerLinks")}>
          <Link to="/acceso">{tr("common.signSpace")}</Link>
          <Link to={pricingPath(locale)}>{tr("pricing.title")}</Link>
          <Link to="/registro">{tr("common.exploreDemo")}</Link>
          <a href="#preguntas">{tr("landing.frequentlyAskedQuestions")}</a>
          <LegalLinks className="landing-legal-links" />
        </nav>
        <small>© {new Date().getFullYear()} TuEventoFun</small>
      </footer>
    </div>
  );
}
