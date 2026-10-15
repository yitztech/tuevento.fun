import type { LegalTexts } from "./types";

/** Datenschutzerklärung und Nutzungsbedingungen auf Deutsch. */
export const de: LegalTexts = {
  missing: "wird auf dieser Seite veröffentlicht",
  address: "Cuernavaca, Morelos, Mexiko",
  privacy: (o) => ({
    title: "Datenschutzerklärung",
    intro:
      "Diese Erklärung beschreibt, welche Informationen TuEventoFun verarbeitet, damit du Events erstellen, private Einladungen verschicken und sehen kannst, wer kommt.",
    sections: [
      {
        title: "Verantwortlicher",
        body: [
          `Anbieter des Dienstes: ${o.name}.`,
          `Anschrift: ${o.address}.`,
          `Kontakt für Datenschutz: ${o.contact}.`,
        ],
      },
      {
        title: "Angaben zu deinem Konto",
        body: [
          "Bei der Registrierung speichern wir deinen Vor- und Nachnamen, deine E-Mail-Adresse, Telefonnummer, deinen Benutzernamen und ein mit scrypt geschütztes Passwort (wir speichern es nie im Klartext). Außerdem speichern wir die Sprache der Domain, über die du dich anmeldest: Jede Sprache hat ihre eigene Domain. Wir schreiben dir in dieser Sprache und von dieser Domain aus.",
          "Wenn du einen Avatar oder ein Logo hochlädst, verkleinern wir es auf 256 × 256 Pixel und behalten nur diese Kopie.",
          "Wenn du dich mit Google anmeldest, erhalten und prüfen wir deinen Namen, deine E-Mail-Adresse und die Kennung deines Google-Kontos. Dein Google-Passwort erhalten wir nicht.",
        ],
      },
      {
        title: "Wofür wir deine Informationen verwenden",
        body: [
          "Um den Dienst zu erbringen, den du nutzt: dein Konto zu erstellen und zu verwalten, dich anmelden und den Zugang wiederherstellen zu lassen, deine Events und Einladungen zu speichern, jedem Gast seine Einladung zu zeigen, die Antworten zu erfassen und dich zu benachrichtigen. Außerdem nutzen wir sie, um die Sicherheit des Dienstes zu gewährleisten und Missbrauch zu verhindern.",
          "Nur wenn du den Newsletter abonnierst: um dir Ideen und Neuigkeiten von TuEventoFun zu schicken. Dieser Zweck ist freiwillig; wenn du nicht abonnierst oder dich abmeldest, hat das keine Auswirkungen auf dein Konto.",
        ],
      },
      {
        title: "Angaben zu deinen Gästen",
        body: [
          "In jedem Event kannst du Einladungen mit Name, E-Mail-Adresse, Telefonnummer und privaten Notizen hinzufügen, dazu den Namen jedes Mitglieds, ob es erwachsen oder ein Kind ist, und seine Notizen. Notizen und Kontaktdaten siehst nur du; die Einladungsseite zeigt den Gästen nur ihre Namen und die Angaben zum Event.",
          "Gäste antworten, ohne ein Konto zu erstellen. Wir speichern die Antwort jedes Mitglieds (Zusage, Absage oder offen) und benachrichtigen dich.",
          "Du bist dafür verantwortlich, die Erlaubnis deiner Gäste einzuholen, bevor du ihre Daten hinzufügst.",
        ],
      },
      {
        title: "Sitzungen und Speicherung auf deinem Gerät",
        body: [
          "Wir verwenden ein Sitzungscookie, das Skripte nicht lesen können (HttpOnly) und das 7 Tage gültig ist, sowie ein temporäres Cookie für 5 Minuten, um die Anmeldung mit Google zu prüfen. Wir verwenden keine Werbecookies.",
          "In den mobilen Apps wird die von dir gewählte Sprache auf deinem Gerät gespeichert.",
          "Um Besuche zu zählen, speichert der Browser eine anonyme Zufallskennung. Wir erfassen die Art der Seite (Startseite, Downloads oder Dashboard), die Plattform (Web, Android oder iOS) und das Datum. Deine IP-Adresse, Einladungslinks und Kontaktdaten erfassen wir in diesen Statistiken nicht.",
          "Ist auf dieser Website die Analyse mit Umami aktiviert, lädt die Seite zusätzlich dessen Skript, um Besuche in zusammengefasster Form zu messen.",
          "Wie jede Website speichern unsere Server technische Zugriffsprotokolle einschließlich der IP-Adresse, um Sicherheit und Betrieb zu gewährleisten.",
        ],
      },
      {
        title: "E-Mails, die wir dir schicken",
        body: [
          "Wenn du das Zurücksetzen deines Passworts anforderst, schicken wir dir einen Link, der nur einmal funktioniert und nach 60 Minuten abläuft; wir speichern nur einen Fingerabdruck (Hash) dieses Links. Wenn sich das Passwort ändert, beenden wir alle offenen Sitzungen und schicken dir einen Sicherheitshinweis.",
          "Diese E-Mails werden in der Sprache der Domain verschickt, die du genutzt hast, und von dieser Domain aus, über einen E-Mail-Versanddienst, der nur erhält, was für die Zustellung nötig ist.",
        ],
      },
      {
        title: "Newsletter",
        body: [
          "Der Newsletter ist freiwillig und unabhängig von deinem Konto. Wenn du ihn abonnierst, speichern wir deine E-Mail-Adresse, den Namen, den du uns angibst, und die Sprache der Domain, auf der du dich angemeldet hast.",
          "Wir verwalten ihn mit Listmonk, einem eigenen Versandwerkzeug, unter der Subdomain news. der Domain jeder Sprache. Du erhältst eine E-Mail zur Bestätigung deines Abonnements, und jede Ausgabe enthält einen Link, mit dem du dich jederzeit abmelden kannst.",
        ],
      },
      {
        title: "Wo und wie lange die Daten gespeichert werden",
        body: [
          "Die Daten werden in einer PostgreSQL-Datenbank auf den Servern des Dienstes gespeichert.",
          "Deine Events, Einladungen und Antworten bleiben gespeichert, bis du sie löschst. Wenn du ein Event oder eine Einladung löschst, werden auch die zugehörigen Gäste und Antworten gelöscht.",
          "Besuchs- und Zugriffsprotokolle werden nach 90 Tagen gelöscht. Demo-Bereiche werden nach 7 Tagen gelöscht. Abgelaufene Sitzungen und Wiederherstellungslinks werden automatisch entfernt.",
          "Newsletter-Abonnements bleiben bestehen, bis du dich abmeldest oder uns bittest, sie zu löschen.",
        ],
      },
      {
        title: "Mit wem wir Daten teilen",
        body: [
          "Wir verkaufen oder vermieten deine Informationen nicht. Wenn du eine Einladung per WhatsApp oder E-Mail teilst, wird sie über deine eigene App oder dein E-Mail-Programm zu deren Bedingungen gesendet.",
          "Google ist nur beteiligt, wenn du dich für die Anmeldung mit Google entscheidest.",
          "Für die Zustellung unserer E-Mails nutzen wir einen E-Mail-Versanddienst, der in unserem Auftrag handelt und deine Informationen für nichts anderes verwenden darf.",
        ],
      },
      {
        title: "Mobile Apps",
        body: [
          "Die Apps für Android und iOS nutzen dasselbe Konto und dieselben hier beschriebenen Informationen.",
        ],
      },
      {
        title: "Deine Rechte",
        body: [
          "Du kannst dein Profil jederzeit in deinem Konto ansehen und korrigieren sowie deine Events und Einladungen löschen.",
          `Um deine Rechte auf Auskunft, Berichtigung, Löschung oder Widerspruch auszuüben, deine Einwilligung zu widerrufen oder dein Konto zu schließen, schreib an den Kontakt für Datenschutz: ${o.contact}. Gib die E-Mail-Adresse deines Kontos an und was du brauchst; wir antworten innerhalb der Fristen des mexikanischen Rechts.`,
        ],
      },
      {
        title: "Änderungen dieser Erklärung",
        body: [
          "Wenn sich diese Erklärung ändert, veröffentlichen wir die neue Fassung mit Datum auf dieser Seite.",
        ],
      },
    ],
  }),
  terms: (o) => ({
    title: "Nutzungsbedingungen",
    intro:
      "Diese Bedingungen gelten, wenn du TuEventoFun im Web oder in den mobilen Apps nutzt.",
    sections: [
      {
        title: "Der Dienst",
        body: [
          "Mit TuEventoFun kannst du Events erstellen, Einladungen gestalten, private Links teilen und die Antworten Person für Person sehen. Anbieter ist " +
            `${o.name} mit Sitz in ${o.address}.`,
        ],
      },
      {
        title: "Dein Konto",
        body: [
          "Du musst wahrheitsgemäße Angaben machen und dein Passwort schützen. Du bist für die Aktivitäten in deinem Konto verantwortlich.",
          "Wenn du dein Passwort vergisst, kannst du einen Link anfordern, um ein neues zu wählen; er wird an die E-Mail-Adresse deines Kontos geschickt.",
          "Jeder Einladungslink ist privat: Wer ihn hat, kann die Einladung sehen und beantworten. Teile ihn nur mit deinen Gästen.",
        ],
      },
      {
        title: "Deine Inhalte und deine Gäste",
        body: [
          "Die Events, Texte und Bilder, die du hinzufügst, gehören dir. Du erlaubst uns, sie ausschließlich zur Erbringung des Dienstes zu speichern und anzuzeigen.",
          "Du musst die Erlaubnis deiner Gäste haben, um ihre Daten hinzuzufügen, und darfst den Dienst nur zur Organisation echter Feiern nutzen, ohne unerwünschte Nachrichten zu verschicken.",
        ],
      },
      {
        title: "Zulässige Nutzung",
        body: [
          "Nutze den Dienst nicht für rechtswidrige Inhalte, um dich als jemand anderes auszugeben oder um zu versuchen, auf fremde Konten oder Daten zuzugreifen. Wir können Konten sperren, die das tun.",
        ],
      },
      {
        title: "Verfügbarkeit",
        body: [
          "Wir arbeiten daran, dass der Dienst verfügbar ist, können aber keinen unterbrechungsfreien Betrieb garantieren. Demo-Bereiche sind vorübergehend und werden nach 7 Tagen gelöscht.",
        ],
      },
      {
        title: "Änderungen und Kontakt",
        body: [
          "Wenn sich diese Bedingungen ändern, veröffentlichen wir die neue Fassung mit Datum auf dieser Seite.",
          `Kontakt: ${o.contact}.`,
        ],
      },
    ],
  }),
};
