import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import {
  type Locale,
  type McpActorType,
  type McpToolName,
  mcpToolNames,
} from "@tuevento/contracts";
import type { McpToolDefinition } from "./mcp.types";

/** Clave derivada para confirmaciones de acciones de escritura en MCP. */
function confirmationKey(): Buffer {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("APP_SECRET is required (32+ random characters)");
  }
  return Buffer.from(hkdfSync("sha256", secret, "", "tuevento:mcp-confirmation", 32));
}

/** Ordena claves para serialización JSON canónica y determinista. */
function canonicalStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(canonicalStringify).join(",")}]`;
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalStringify((obj as Record<string, unknown>)[k])}`,
  );
  return `{${pairs.join(",")}}`;
}

export interface ConfirmationPayload {
  actorId: string;
  toolName: McpToolName;
  argsCanonical: string;
  exp: number;
}

/** Genera un token HMAC de confirmación con 10 minutos de caducidad. */
export function generateConfirmationToken(
  actorId: string,
  toolName: McpToolName,
  cleanArgs: Record<string, unknown>,
  ttlSeconds = 600,
): { confirmationToken: string; expiresAt: Date } {
  const exp = Date.now() + ttlSeconds * 1000;
  const argsCanonical = canonicalStringify(cleanArgs);
  const dataToSign = `${actorId}:${toolName}:${argsCanonical}:${exp}`;
  const sig = createHmac("sha256", confirmationKey()).update(dataToSign).digest("base64url");
  const token = Buffer.from(JSON.stringify({ actorId, toolName, exp, sig })).toString("base64url");
  return { confirmationToken: token, expiresAt: new Date(exp) };
}

/** Verifica que el token de confirmación corresponda exactamente al actor, herramienta y argumentos. */
export function verifyConfirmationToken(
  token: string,
  actorId: string,
  toolName: McpToolName,
  cleanArgs: Record<string, unknown>,
): boolean {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as {
      actorId: string;
      toolName: string;
      exp: number;
      sig: string;
    };
    if (parsed.actorId !== actorId || parsed.toolName !== toolName) return false;
    if (parsed.exp < Date.now()) return false;

    const argsCanonical = canonicalStringify(cleanArgs);
    const expectedData = `${actorId}:${toolName}:${argsCanonical}:${parsed.exp}`;
    const expectedSig = createHmac("sha256", confirmationKey())
      .update(expectedData)
      .digest("base64url");

    const a = Buffer.from(parsed.sig, "utf8");
    const b = Buffer.from(expectedSig, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Limpia parámetros quitando banderas internas de confirmación e idempotencia. */
export function stripConfirmationFields(args: Record<string, unknown>): Record<string, unknown> {
  const { preview, confirmed, confirmation_token, idempotency_key, ...rest } = args;
  return rest;
}

/** Caché de idempotencia en memoria con TTL de 15 minutos. */
interface IdempotencyRecord {
  paramsHash: string;
  result: unknown;
  timestamp: number;
}
const idempotencyCache = new Map<string, IdempotencyRecord>();
const IDEMPOTENCY_TTL_MS = 15 * 60 * 1000;

export function checkIdempotency(key: string, cleanArgs: Record<string, unknown>): { hit: boolean; result?: unknown; conflict?: boolean } {
  const now = Date.now();
  // Limpieza periódica de registros viejos
  if (idempotencyCache.size > 1000) {
    for (const [k, v] of idempotencyCache.entries()) {
      if (now - v.timestamp > IDEMPOTENCY_TTL_MS) idempotencyCache.delete(k);
    }
  }

  const existing = idempotencyCache.get(key);
  if (!existing) return { hit: false };
  if (now - existing.timestamp > IDEMPOTENCY_TTL_MS) {
    idempotencyCache.delete(key);
    return { hit: false };
  }

  const currentHash = canonicalStringify(cleanArgs);
  if (existing.paramsHash !== currentHash) {
    return { hit: false, conflict: true };
  }
  return { hit: true, result: existing.result };
}

export function saveIdempotency(key: string, cleanArgs: Record<string, unknown>, result: unknown) {
  idempotencyCache.set(key, {
    paramsHash: canonicalStringify(cleanArgs),
    result,
    timestamp: Date.now(),
  });
}

/** Catálogo de descripciones y esquemas de entrada para MCP tools/list. */
export const toolDescriptions: Record<McpToolName, Record<Locale, string>> = {
  events_list: {
    es: "Lista los eventos del organizador autenticado con paginación y estado.",
    en: "List events owned by the authenticated organizer with pagination and status.",
    pt: "Lista os eventos do organizador autenticado com paginação e status.",
    de: "Listet die Events des authentifizierten Veranstalters mit Paginierung und Status auf.",
    fr: "Liste les événements de l'organisateur authentifié avec pagination et état.",
  },
  events_get: {
    es: "Obtiene los detalles completos de un evento propio por ID o slug.",
    en: "Get full details of an owned event by ID or slug.",
    pt: "Obtém os detalhes completos de um evento próprio por ID ou slug.",
    de: "Ruft die vollständigen Details eines eigenen Events nach ID oder Slug ab.",
    fr: "Obtient les détails complets d'un événement propre par ID ou slug.",
  },
  events_attendance_summary: {
    es: "Métricas de asistencia de un evento (confirmados, declinados, pendientes, adultos y niños).",
    en: "Attendance metrics for an event (confirmed, declined, pending, adults, and children).",
    pt: "Métricas de confirmação de presença de um evento (confirmados, recusados, pendentes, adultos e crianças).",
    de: "Teilnahmemetriken für ein Event (zugesagt, abgelehnt, ausstehend, Erwachsene und Kinder).",
    fr: "Métriques de présence pour un événement (confirmés, déclinés, en attente, adultes et enfants).",
  },
  providers_search: {
    es: "Búsqueda pública de proveedores de eventos por texto, categoría y ubicación geográfica.",
    en: "Public search for event providers by query, category, and geographic coordinates.",
    pt: "Busca pública de fornecedores de eventos por texto, categoria e localização geográfica.",
    de: "Öffentliche Suche nach Event-Dienstleistern nach Text, Kategorie und geografischem Standort.",
    fr: "Recherche publique de prestataires d'événements par texte, catégorie et coordonnées géographiques.",
  },
  provider_profile_get: {
    es: "Obtiene el perfil del negocio del proveedor autenticado, estado y requisitos pendientes.",
    en: "Get the profile of the authenticated provider's business, publish status, and completeness.",
    pt: "Obtém o perfil do negócio do fornecedor autenticado, status e requisitos pendentes.",
    de: "Ruft das Unternehmensprofil des authentifizierten Dienstleisters, Status und Vollständigkeit ab.",
    fr: "Obtient le profil de l'entreprise du prestataire authentifié, statut et exigences restantes.",
  },
  provider_services_list: {
    es: "Lista los servicios y precios configurados por el proveedor autenticado.",
    en: "List services and pricing configured by the authenticated provider.",
    pt: "Lista os serviços e preços configurados pelo fornecedor autenticado.",
    de: "Listet die vom authentifizierten Dienstleister konfigurierten Leistungen und Preise auf.",
    fr: "Liste les services et tarifs configurés par le prestataire authentifié.",
  },
  invitation_get: {
    es: "Obtiene los datos de una invitación y sus integrantes permitidos.",
    en: "Get details of an invitation and its permitted members.",
    pt: "Obtém os dados de um convite e seus integrantes permitidos.",
    de: "Ruft die Daten einer Einladung und ihrer zugelassenen Mitglieder ab.",
    fr: "Obtient les données d'une invitation et de ses membres autorisés.",
  },
  invitation_rsvp_get: {
    es: "Consulta el estado actual de confirmación de asistencia (RSVP) de los integrantes de la invitación.",
    en: "Check the current RSVP attendance status for members of the invitation.",
    pt: "Consulta o status atual de confirmação de presença (RSVP) dos integrantes do convite.",
    de: "Prüft den aktuellen RSVP-Teilnahmestatus für die Mitglieder der Einladung.",
    fr: "Consulte l'état actuel de réponse (RSVP) des membres de l'invitation.",
  },
  events_create: {
    es: "Crea un nuevo evento para el organizador. Admite vista previa antes de confirmación.",
    en: "Create a new event for the organizer. Supports preview before confirmation.",
    pt: "Cria um novo evento para o organizador. Permite prévia antes da confirmação.",
    de: "Erstellt ein neues Event für den Veranstalter. Unterstützt eine Vorschau vor der Bestätigung.",
    fr: "Crée un nouvel événement pour l'organisateur. Permet un aperçu avant confirmation.",
  },
  events_update: {
    es: "Actualiza los datos de un evento propio. Admite vista previa antes de confirmación.",
    en: "Update an owned event. Supports preview before confirmation.",
    pt: "Atualiza os dados de um evento próprio. Permite prévia antes da confirmação.",
    de: "Aktualisiert ein eigenes Event. Unterstützt eine Vorschau vor der Bestätigung.",
    fr: "Met à jour un événement propre. Permet un aperçu avant confirmation.",
  },
  invitations_create: {
    es: "Crea una nueva invitación con sus integrantes en un evento propio.",
    en: "Create a new invitation with members in an owned event.",
    pt: "Cria um novo convite com integrantes em um evento próprio.",
    de: "Erstellt eine neue Einladung mit Mitgliedern in einem eigenen Event.",
    fr: "Crée une nouvelle invitation avec ses membres dans un événement propre.",
  },
  invitations_update: {
    es: "Actualiza una invitación existente de un evento propio.",
    en: "Update an existing invitation of an owned event.",
    pt: "Atualiza um convite existente de um evento próprio.",
    de: "Aktualisiert eine bestehende Einladung eines eigenen Events.",
    fr: "Met à jour une invitation existante d'un événement propre.",
  },
  provider_profile_update: {
    es: "Actualiza los datos del perfil de negocio del proveedor autenticado.",
    en: "Update the business profile of the authenticated provider.",
    pt: "Atualiza os dados do perfil de negócio do fornecedor autenticado.",
    de: "Aktualisiert die Unternehmensprofildaten des authentifizierten Dienstleisters.",
    fr: "Met à jour les données du profil d'entreprise du prestataire authentifié.",
  },
  provider_services_update: {
    es: "Crea, actualiza o elimina un servicio o precio del proveedor autenticado.",
    en: "Create, update, or remove a service or pricing for the authenticated provider.",
    pt: "Cria, atualiza ou exclui um serviço ou preço do fornecedor autenticado.",
    de: "Erstellt, aktualisiert oder entfernt eine Leistung oder einen Preis des Dienstleisters.",
    fr: "Crée, met à jour ou supprime un service ou tarif du prestataire authentifié.",
  },
  invitation_rsvp_update: {
    es: "Registra o actualiza la confirmación de asistencia (RSVP) de los integrantes autorizados.",
    en: "Register or update attendance (RSVP) for authorized members of the invitation.",
    pt: "Registra ou atualiza a confirmação de presença (RSVP) dos integrantes autorizados.",
    de: "Erfasst oder aktualisiert die Zusage (RSVP) für autorisierte Mitglieder der Einladung.",
    fr: "Enregistre ou met à jour la confirmation de présence (RSVP) des membres autorisés.",
  },
};

/** Esquemas JSON Schema simplificados para cada herramienta para cumplir con MCP tools/list. */
export const toolInputSchemas: Record<McpToolName, Record<string, unknown>> = {
  events_list: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["accepted", "declined", "pending"], description: "Filtrar por estado" },
      limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
      offset: { type: "integer", minimum: 0, default: 0 },
    },
  },
  events_get: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string", description: "Identificador UUID o dirección (slug) del evento" },
    },
  },
  events_attendance_summary: {
    type: "object",
    required: ["eventId"],
    properties: {
      eventId: { type: "string", description: "Identificador UUID o dirección (slug) del evento" },
    },
  },
  providers_search: {
    type: "object",
    properties: {
      query: { type: "string", maxLength: 100, description: "Término de búsqueda" },
      category: { type: "string", description: "Categoría de proveedor" },
      lat: { type: "number", minimum: -90, maximum: 90 },
      lng: { type: "number", minimum: -180, maximum: 180 },
      radiusKm: { type: "number", minimum: 1, maximum: 500 },
      limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
    },
  },
  provider_profile_get: { type: "object", properties: {} },
  provider_services_list: { type: "object", properties: {} },
  invitation_get: {
    type: "object",
    properties: {
      invitationId: { type: "string", format: "uuid", description: "ID de invitación (requerido para organizadores, automático para invitados)" },
    },
  },
  invitation_rsvp_get: {
    type: "object",
    properties: {
      invitationId: { type: "string", format: "uuid" },
    },
  },
  events_create: {
    type: "object",
    required: ["title", "date", "timeZone", "location", "theme"],
    properties: {
      title: { type: "string", minLength: 3, maxLength: 100 },
      slug: { type: "string", minLength: 1, maxLength: 60 },
      date: { type: "string", format: "date-time" },
      timeZone: { type: "string" },
      location: { type: "string", minLength: 1, maxLength: 200 },
      theme: { type: "string" },
      description: { type: "string", maxLength: 2500 },
      coordinates: {
        type: "object",
        required: ["lat", "lng"],
        properties: { lat: { type: "number" }, lng: { type: "number" } },
      },
      preview: { type: "boolean", default: false },
      confirmed: { type: "boolean", default: false },
      confirmation_token: { type: "string" },
      idempotency_key: { type: "string" },
    },
  },
  events_update: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string" },
      title: { type: "string", minLength: 3, maxLength: 100 },
      slug: { type: "string", minLength: 1, maxLength: 60 },
      date: { type: "string", format: "date-time" },
      timeZone: { type: "string" },
      location: { type: "string", minLength: 1, maxLength: 200 },
      theme: { type: "string" },
      description: { type: "string", maxLength: 2500 },
      coordinates: {
        type: "object",
        properties: { lat: { type: "number" }, lng: { type: "number" } },
      },
      preview: { type: "boolean", default: false },
      confirmed: { type: "boolean", default: false },
      confirmation_token: { type: "string" },
      idempotency_key: { type: "string" },
    },
  },
  invitations_create: {
    type: "object",
    required: ["eventId", "name", "kind", "members"],
    properties: {
      eventId: { type: "string" },
      name: { type: "string", minLength: 1, maxLength: 50 },
      kind: { type: "string", enum: ["individual", "family"] },
      contact: { type: "string", maxLength: 20 },
      members: {
        type: "array",
        items: {
          type: "object",
          required: ["name", "kind"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 50 },
            kind: { type: "string", enum: ["adult", "child"] },
          },
        },
      },
      preview: { type: "boolean", default: false },
      confirmed: { type: "boolean", default: false },
      confirmation_token: { type: "string" },
      idempotency_key: { type: "string" },
    },
  },
  invitations_update: {
    type: "object",
    required: ["eventId", "id"],
    properties: {
      eventId: { type: "string" },
      id: { type: "string", format: "uuid" },
      name: { type: "string", minLength: 1, maxLength: 50 },
      kind: { type: "string", enum: ["individual", "family"] },
      contact: { type: "string", maxLength: 20 },
      members: {
        type: "array",
        items: {
          type: "object",
          required: ["name", "kind"],
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string", minLength: 1, maxLength: 50 },
            kind: { type: "string", enum: ["adult", "child"] },
            status: { type: "string", enum: ["accepted", "declined", "pending"] },
          },
        },
      },
      preview: { type: "boolean", default: false },
      confirmed: { type: "boolean", default: false },
      confirmation_token: { type: "string" },
      idempotency_key: { type: "string" },
    },
  },
  provider_profile_update: {
    type: "object",
    properties: {
      businessName: { type: "string", minLength: 1, maxLength: 150 },
      slug: { type: "string", minLength: 1, maxLength: 60 },
      headline: { type: "string", maxLength: 150 },
      description: { type: "string", maxLength: 5000 },
      categories: { type: "array", items: { type: "string" } },
      serviceRadiusKm: { type: "integer", minimum: 0, maximum: 500 },
      address: { type: "string", maxLength: 200 },
      city: { type: "string", maxLength: 200 },
      region: { type: "string", maxLength: 200 },
      postalCode: { type: "string", maxLength: 10 },
      phone: { type: "string", maxLength: 20 },
      whatsapp: { type: "string", maxLength: 20 },
      publicEmail: { type: "string", format: "email" },
      website: { type: "string", format: "uri" },
      instagramUrl: { type: "string", format: "uri" },
      facebookUrl: { type: "string", format: "uri" },
      tiktokUrl: { type: "string", format: "uri" },
      coordinates: {
        type: "object",
        properties: { lat: { type: "number" }, lng: { type: "number" } },
      },
      preview: { type: "boolean", default: false },
      confirmed: { type: "boolean", default: false },
      confirmation_token: { type: "string" },
      idempotency_key: { type: "string" },
    },
  },
  provider_services_update: {
    type: "object",
    required: ["action"],
    properties: {
      action: { type: "string", enum: ["create", "update", "delete"] },
      serviceId: { type: "string", format: "uuid" },
      title: { type: "string", minLength: 1, maxLength: 150 },
      description: { type: "string", maxLength: 2000 },
      price: {
        type: "object",
        properties: {
          fromCents: { type: "integer", minimum: 0 },
          currency: { type: "string" },
          unit: { type: "string", enum: ["event", "hour", "person", "item", "day"] },
        },
      },
      preview: { type: "boolean", default: false },
      confirmed: { type: "boolean", default: false },
      confirmation_token: { type: "string" },
      idempotency_key: { type: "string" },
    },
  },
  invitation_rsvp_update: {
    type: "object",
    required: ["members"],
    properties: {
      invitationId: { type: "string", format: "uuid" },
      members: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "status"],
          properties: {
            id: { type: "string", format: "uuid" },
            status: { type: "string", enum: ["accepted", "declined", "pending"] },
          },
        },
      },
      preview: { type: "boolean", default: false },
      confirmed: { type: "boolean", default: false },
      confirmation_token: { type: "string" },
      idempotency_key: { type: "string" },
    },
  },
};

/** Obtiene la lista de definiciones de herramientas según actor, permisos y locale. */
export function getToolsForActor(
  actorType: McpActorType,
  scopes: string[],
  locale: Locale,
): McpToolDefinition[] {
  const allowedToolNames = mcpToolNames.filter((name) => {
    // Verificar matriz de actor
    const actorMatrix: Record<McpActorType, McpToolName[]> = {
      organizer: [
        "events_list",
        "events_get",
        "events_attendance_summary",
        "providers_search",
        "events_create",
        "events_update",
        "invitations_create",
        "invitations_update",
        "invitation_get",
      ],
      provider: [
        "provider_profile_get",
        "provider_services_list",
        "provider_profile_update",
        "provider_services_update",
      ],
      guest: [
        "invitation_get",
        "invitation_rsvp_get",
        "invitation_rsvp_update",
      ],
    };

    if (!actorMatrix[actorType].includes(name)) return false;

    // Verificar ámbito (scope)
    const isWrite = [
      "events_create",
      "events_update",
      "invitations_create",
      "invitations_update",
      "provider_profile_update",
      "provider_services_update",
      "invitation_rsvp_update",
    ].includes(name);

    if (isWrite && !scopes.includes("mcp:write")) return false;
    if (!isWrite && !scopes.includes("mcp:read")) return false;
    return true;
  });

  return allowedToolNames.map((name) => ({
    name,
    description: toolDescriptions[name][locale] || toolDescriptions[name].es,
    inputSchema: toolInputSchemas[name],
  }));
}
