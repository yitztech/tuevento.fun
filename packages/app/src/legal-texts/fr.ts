import type { LegalTexts } from "./types";

/** Politique de confidentialité et conditions d’utilisation en français. */
export const fr: LegalTexts = {
  missing: "à publier sur cette page",
  address: "Cuernavaca, Morelos, Mexique",
  privacy: (o) => ({
    title: "Politique de confidentialité",
    intro:
      "Cette politique explique quelles informations TuEventoFun traite pour que tu puisses créer des événements, envoyer des invitations privées et savoir qui viendra.",
    sections: [
      {
        title: "Qui est responsable",
        body: [
          `Responsable du service : ${o.name}.`,
          `Adresse : ${o.address}.`,
          `Contact confidentialité : ${o.contact}.`,
        ],
      },
      {
        title: "Les informations de ton compte",
        body: [
          "Lors de ton inscription, nous enregistrons tes nom et prénom, ton e-mail, ton téléphone et un mot de passe protégé par scrypt (nous ne le conservons jamais en clair). Nous enregistrons aussi la langue de la page par laquelle tu t’inscris ; nous t’écrivons dans cette langue, depuis le domaine de cette langue.",
          "Si tu téléverses un avatar ou un logo, nous le réduisons à 256 × 256 pixels et ne conservons que cette copie.",
          "Si tu te connectes avec Google, nous recevons et vérifions ton nom, ton e-mail et l’identifiant de ton compte Google. Nous ne recevons pas ton mot de passe Google.",
        ],
      },
      {
        title: "À quoi servent tes informations",
        body: [
          "À fournir le service que tu demandes : créer et gérer ton compte, te permettre de te connecter et de récupérer ton accès, enregistrer tes événements et invitations, montrer à chaque invité son invitation, enregistrer les réponses et te prévenir. Nous les utilisons aussi pour assurer la sécurité du service et éviter les abus.",
          "Uniquement si tu t’abonnes à la newsletter : t’envoyer des idées et des nouveautés de TuEventoFun. Cette finalité est facultative ; ne pas t’abonner, ou te désabonner, n’a aucun effet sur ton compte.",
        ],
      },
      {
        title: "Les informations de tes invités",
        body: [
          "Dans chaque événement, tu peux ajouter des invitations avec un nom, un e-mail, un téléphone et des notes privées, ainsi que le nom de chaque membre, s’il est adulte ou enfant et ses notes. Toi seul vois les notes et les coordonnées ; la page d’invitation ne montre aux invités que leurs noms et les informations de l’événement.",
          "Les invités répondent sans créer de compte. Nous enregistrons la réponse de chaque membre (présent, absent ou en attente) et nous te prévenons.",
          "Il t’appartient d’obtenir l’accord de tes invités avant d’ajouter leurs données.",
          "Si tu partages un lien ouvert, la personne qui s’inscrit saisit ses propres coordonnées et celles des personnes qui viennent avec elle. Tu vois ces données, comme celles de tes autres invitations.",
        ],
      },
      {
        title: "Carte postale et adresse publique de l’événement",
        body: [
          "La carte postale de chaque événement peut comporter jusqu’à deux photos que tu envoies. Avant de les enregistrer, nous retirons leurs métadonnées, comme le lieu où elles ont été prises, nous les orientons et nous les réduisons à 2 048 pixels au maximum.",
          "Les photos de la carte postale sont affichées à toute personne qui a l’invitation ou l’adresse publique de l’événement. Chaque photo a un identifiant aléatoire impossible à deviner. Tu peux retirer une photo à tout moment ; la suppression de l’événement entraîne celle de ses photos.",
          "Si tu donnes une adresse publique à l’événement, toute personne qui la connaît voit le titre, la description, la date, le lieu, le nom de l’hôte et la carte postale. Tes invités, leurs coordonnées et leurs réponses ne sont jamais affichés. Tu peux retirer ou modifier l’adresse à tout moment ; elle n’est plus visible si tu archives l’événement.",
          "Nous conservons jusqu’à 20 versions précédentes de la carte postale pour que tu puisses y revenir. Elles sont supprimées avec l’événement.",
          "Tu peux protéger la page publique par un mot de passe. Nous ne gardons qu’une empreinte du mot de passe et de l’accès qu’il accorde, qui expire au bout de 24 heures. Le fichier de calendrier téléchargé (.ics) ne contient que les données de l’événement.",
        ],
      },
      {
        title: "Sessions et stockage sur ton appareil",
        body: [
          "Nous utilisons un cookie de session que les scripts ne peuvent pas lire (HttpOnly) et qui dure 7 jours, ainsi qu’un cookie temporaire de 5 minutes pour vérifier la connexion avec Google. Nous n’utilisons pas de cookies publicitaires.",
          "Dans les applications mobiles, la langue que tu choisis est enregistrée sur ton appareil. Sur le web, ton navigateur retient si tu as accepté ou refusé la langue qu’il propose.",
          "Pour compter les visites, le navigateur conserve un identifiant aléatoire anonyme. Nous enregistrons le type de page (accueil, téléchargements ou tableau de bord), la plateforme (web, Android ou iOS) et la date. Nous n’enregistrons ni ton adresse IP, ni les liens d’invitation, ni les coordonnées dans ces statistiques.",
          "Si l’analyse d’audience avec Umami est activée sur ce site, la page charge aussi son script pour mesurer les visites de façon agrégée.",
          "Comme tout site web, nos serveurs conservent des journaux techniques d’accès, qui incluent l’adresse IP, pour la sécurité et le bon fonctionnement.",
        ],
      },
      {
        title: "Les e-mails que nous t’envoyons",
        body: [
          "Si tu demandes à réinitialiser ton mot de passe, nous t’envoyons un lien qui ne fonctionne qu’une fois et expire au bout de 60 minutes ; nous ne conservons qu’une empreinte (hash) de ce lien. Quand le mot de passe change, nous fermons toutes les sessions ouvertes et t’envoyons un avis de sécurité.",
          "Ces e-mails sont envoyés dans la langue de ton compte, depuis le domaine de cette langue, par l’intermédiaire d’un prestataire d’envoi d’e-mails qui ne reçoit que ce qui est nécessaire pour les remettre.",
          "Nous t’écrivons quand quelqu’un répond ou s’inscrit à ton événement, et quand tu modifies la date ou le lieu ou que tu annules l’événement. Aux invités qui ont laissé leur e-mail, nous envoyons la confirmation de leur réponse et ces avis. Nous n’utilisons cette adresse que pour cela.",
        ],
      },
      {
        title: "Newsletter",
        body: [
          "La newsletter est facultative et indépendante de ton compte. Si tu t’abonnes, nous conservons ton e-mail, le nom que tu nous donnes et la langue de la page où tu t’es abonné.",
          "Nous la gérons avec Listmonk, notre propre outil d’envoi, sur le sous-domaine news. du domaine de chaque langue. Tu recevras un e-mail pour confirmer ton abonnement, et chaque envoi contient un lien pour te désabonner à tout moment.",
        ],
      },
      {
        title: "Où et combien de temps",
        body: [
          "Les photos des cartes postales sont stockées sur le disque du serveur, dans un volume dédié séparé de la base de données. Elles sont conservées tant que l’événement existe.",
          "Les données sont stockées dans une base de données PostgreSQL sur les serveurs du service.",
          "Tes événements, invitations et réponses sont conservés jusqu’à ce que tu les supprimes. Supprimer un événement ou une invitation efface aussi ses invités et ses réponses.",
          "Les journaux de visites et de connexions sont effacés au bout de 90 jours. Les espaces de démonstration sont effacés au bout de 7 jours. Les sessions et les liens de récupération expirés sont supprimés automatiquement.",
          "Les abonnements à la newsletter sont conservés jusqu’à ce que tu te désabonnes ou que tu nous demandes de les effacer.",
        ],
      },
      {
        title: "Avec qui nous partageons",
        body: [
          "Nous ne vendons ni ne louons tes informations. Quand tu partages une invitation par WhatsApp ou par e-mail, elle part depuis ta propre application ou ta messagerie, selon leurs conditions.",
          "Google n’intervient que si tu choisis de te connecter avec Google.",
          "Pour remettre nos e-mails, nous faisons appel à un prestataire d’envoi qui agit pour notre compte et ne peut pas utiliser tes informations à d’autres fins.",
        ],
      },
      {
        title: "Applications mobiles",
        body: [
          "Les applications Android et iOS utilisent le même compte et les mêmes informations que celles décrites ici.",
        ],
      },
      {
        title: "Tes droits",
        body: [
          "Tu peux consulter et corriger ton profil depuis ton compte à tout moment, et supprimer tes événements et invitations.",
          `Pour exercer tes droits d’accès, de rectification, d’effacement ou d’opposition, retirer ton consentement ou fermer ton compte, écris au contact confidentialité : ${o.contact}. Indique l’e-mail de ton compte et ce dont tu as besoin ; nous te répondrons dans les délais prévus par la loi mexicaine.`,
        ],
      },
      {
        title: "Modifications de cette politique",
        body: [
          "Si cette politique change, nous publierons la nouvelle version sur cette page, avec sa date.",
        ],
      },
    ],
  }),
  terms: (o) => ({
    title: "Conditions d’utilisation",
    intro:
      "Ces conditions s’appliquent lorsque tu utilises TuEventoFun sur le web ou dans ses applications mobiles.",
    sections: [
      {
        title: "Le service",
        body: [
          "TuEventoFun te permet de créer des événements, de concevoir des invitations, de partager des liens privés et de suivre les réponses personne par personne. Il est proposé par " +
            `${o.name}, domicilié à ${o.address}.`,
        ],
      },
      {
        title: "Ton compte",
        body: [
          "Tu dois fournir des informations exactes et protéger ton mot de passe. Tu es responsable de l’activité de ton compte.",
          "Si tu oublies ton mot de passe, tu peux demander un lien pour en choisir un nouveau ; il arrive à l’e-mail de ton compte.",
          "Chaque lien d’invitation est privé : toute personne qui l’a peut voir l’invitation et y répondre. Ne le partage qu’avec tes invités.",
        ],
      },
      {
        title: "Ton contenu et tes invités",
        body: [
          "Les événements, textes et images que tu ajoutes t’appartiennent. Tu nous autorises à les conserver et à les afficher uniquement pour fournir le service.",
          "Tu dois avoir l’accord de tes invités pour ajouter leurs données et n’utiliser le service que pour organiser de vraies fêtes, sans envoyer de messages non sollicités.",
        ],
      },
      {
        title: "Utilisation acceptable",
        body: [
          "N’utilise pas le service pour des contenus illégaux, pour te faire passer pour quelqu’un d’autre ni pour tenter d’accéder aux comptes ou aux données d’autrui. Nous pouvons suspendre les comptes qui le font.",
        ],
      },
      {
        title: "Disponibilité",
        body: [
          "Nous faisons en sorte que le service soit disponible, mais nous ne pouvons pas garantir qu’il fonctionne sans interruption. Les espaces de démonstration sont temporaires et effacés au bout de 7 jours.",
        ],
      },
      {
        title: "Modifications et contact",
        body: [
          "Si ces conditions changent, nous publierons la nouvelle version sur cette page, avec sa date.",
          `Contact : ${o.contact}.`,
        ],
      },
    ],
  }),
};
