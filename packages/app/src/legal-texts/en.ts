import type { LegalTexts } from "./types";

/** Privacy policy and terms of use in English. */
export const en: LegalTexts = {
  missing: "to be published on this page",
  address: "Cuernavaca, Morelos, Mexico",
  privacy: (o) => ({
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
          "When you sign up we store your first and last name, email, phone number and a password protected with scrypt (we never store it in plain text). We also store the language of the domain you use to sign in: tuevento.fun for Spanish and yourevent.fun for English. We write to you in that language and from that domain.",
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
  }),
  terms: (o) => ({
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
  }),
};
