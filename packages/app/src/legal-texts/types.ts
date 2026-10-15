export type LegalSection = { title: string; body: string[] };
export type LegalContent = { title: string; intro: string; sections: LegalSection[] };
/** Datos del titular ya resueltos para un idioma (lo que falta se indica con `missing`). */
export type LegalOwner = { name: string; address: string; contact: string };
/** Textos legales de un idioma. Son documentos largos: viven aquí y no en el catálogo. */
export type LegalTexts = {
  /** Lo que se muestra en lugar de un dato del titular que aún no se ha publicado. */
  missing: string;
  /** Domicilio del titular escrito en este idioma; null mientras no esté publicado. */
  address: string | null;
  privacy: (owner: LegalOwner) => LegalContent;
  terms: (owner: LegalOwner) => LegalContent;
};
