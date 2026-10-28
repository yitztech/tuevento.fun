import { Injectable, Logger } from "@nestjs/common";
import {
  type Locale,
  type McpActorType,
  type McpScope,
  type McpToolName,
  type MessageKey,
  mcpActorToolMatrix,
  mcpMessages,
  mcpToolNames,
  mcpToolScopeMatrix,
  mcpToolSchemas,
  translate,
} from "@tuevento/contracts";
import { Database } from "../database";
import { EventsService } from "../events";
import { ProvidersService } from "../providers";
import {
  checkIdempotency,
  generateConfirmationToken,
  getToolsForActor,
  saveIdempotency,
  stripConfirmationFields,
  verifyConfirmationToken,
} from "./mcp.tools";
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  McpAuthContext,
  McpToolCallResult,
} from "./mcp.types";

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);

  constructor(
    private db: Database,
    private events: EventsService,
    private providers: ProvidersService,
  ) {}

  /** Maneja una solicitud JSON-RPC 2.0 completa bajo el contexto del actor autenticado. */
  async handleJsonRpc(
    req: JsonRpcRequest,
    auth: McpAuthContext,
  ): Promise<JsonRpcResponse> {
    const id = req.id !== undefined ? req.id : null;

    if (req.jsonrpc !== "2.0" || !req.method) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32600, message: "Invalid Request: expected jsonrpc 2.0" },
      };
    }

    try {
      switch (req.method) {
        case "initialize": {
          return {
            jsonrpc: "2.0",
            id,
            result: {
              protocolVersion: "2024-11-05",
              capabilities: {
                tools: { listChanged: false },
                resources: { listChanged: false },
              },
              serverInfo: {
                name: "tuevento-mcp",
                version: "1.0.0",
              },
            },
          };
        }

        case "notifications/initialized":
        case "ping": {
          return {
            jsonrpc: "2.0",
            id,
            result: {},
          };
        }

        case "tools/list": {
          const tools = getToolsForActor(auth.actorType, auth.scopes, auth.locale);
          return {
            jsonrpc: "2.0",
            id,
            result: { tools },
          };
        }

        case "tools/call": {
          const toolCall = await this.handleToolCall(req.params, auth);
          return {
            jsonrpc: "2.0",
            id,
            result: toolCall,
          };
        }

        default: {
          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Method not found: ${req.method}` },
          };
        }
      }
    } catch (err: unknown) {
      this.logger.error(`MCP Error in ${req.method}: ${err instanceof Error ? err.message : String(err)}`);
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32603,
          message: err instanceof Error ? err.message : "Internal error",
        },
      };
    }
  }

  private async handleToolCall(
    params: Record<string, unknown> | undefined,
    auth: McpAuthContext,
  ): Promise<McpToolCallResult> {
    if (!params || typeof params.name !== "string") {
      return {
        isError: true,
        content: [{ type: "text", text: "Invalid params: name is required" }],
      };
    }

    const toolName = params.name as McpToolName;
    if (!mcpToolNames.includes(toolName)) {
      return {
        isError: true,
        content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
      };
    }

    // 1. Autorización por actor
    const allowedForActor = mcpActorToolMatrix[auth.actorType];
    if (!allowedForActor.includes(toolName)) {
      this.logger.warn(`Actor ${auth.actorType} intentó acceder a herramienta no autorizada: ${toolName}`);
      return {
        isError: true,
        content: [{ type: "text", text: translate(auth.locale, mcpMessages.forbidden) }],
      };
    }

    // 2. Autorización por ámbito (scope)
    const requiredScope = mcpToolScopeMatrix[toolName];
    if (!auth.scopes.includes(requiredScope)) {
      return {
        isError: true,
        content: [{ type: "text", text: translate(auth.locale, mcpMessages.scopeRequired, { scope: requiredScope }) }],
      };
    }

    // 3. Validación de esquema de entrada con Zod
    const rawArgs = (params.arguments as Record<string, unknown>) || {};
    const schema = mcpToolSchemas[toolName];
    const parseResult = schema.safeParse(rawArgs);
    if (!parseResult.success) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Validation error: ${parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
          },
        ],
      };
    }

    const validatedArgs = parseResult.data as Record<string, unknown>;
    const cleanArgs = stripConfirmationFields(validatedArgs);
    const actorId = auth.userId || auth.invitationId || "";

    // 4. Verificación de confirmación e idempotencia para escrituras
    const isWrite = [
      "events_create",
      "events_update",
      "invitations_create",
      "invitations_update",
      "provider_profile_update",
      "provider_services_update",
      "invitation_rsvp_update",
    ].includes(toolName);

    if (isWrite) {
      const idempotencyKey = validatedArgs.idempotency_key as string | undefined;
      if (idempotencyKey) {
        const idem = checkIdempotency(idempotencyKey, cleanArgs);
        if (idem.hit) {
          return {
            content: [{ type: "text", text: JSON.stringify(idem.result, null, 2) }],
          };
        }
        if (idem.conflict) {
          return {
            isError: true,
            content: [{ type: "text", text: "Idempotency conflict: key was reused with different arguments" }],
          };
        }
      }

      const preview = validatedArgs.preview === true;
      const confirmed = validatedArgs.confirmed === true;
      const confirmationToken = validatedArgs.confirmation_token as string | undefined;

      if (preview || (!confirmed && !confirmationToken)) {
        const { confirmationToken: token, expiresAt } = generateConfirmationToken(
          actorId,
          toolName,
          cleanArgs,
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  preview: true,
                  requiresConfirmation: true,
                  confirmationToken: token,
                  expiresAt: expiresAt.toISOString(),
                  message: translate(auth.locale, mcpMessages.confirmationRequired),
                  summary: translate(auth.locale, mcpMessages.previewSummary, { tool: toolName }),
                  proposedChanges: cleanArgs,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      if (!confirmationToken || !verifyConfirmationToken(confirmationToken, actorId, toolName, cleanArgs)) {
        return {
          isError: true,
          content: [{ type: "text", text: translate(auth.locale, mcpMessages.confirmationRequired) }],
        };
      }
    }

    // 5. Ejecución de la herramienta
    const start = Date.now();
    try {
      const result = await this.executeTool(toolName, cleanArgs, auth);
      const durationMs = Date.now() - start;
      this.logger.log(`MCP Tool ${toolName} ejecutada por ${auth.actorType}:${actorId} (${durationMs}ms)`);

      if (isWrite && validatedArgs.idempotency_key) {
        saveIdempotency(validatedArgs.idempotency_key as string, cleanArgs, result);
      }

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - start;
      const rawMsg = err instanceof Error ? err.message : "Tool execution failed";
      let errorMsg = rawMsg;
      try {
        const translated = translate(auth.locale, rawMsg as unknown as MessageKey);
        if (translated && !translated.startsWith("errors.")) {
          errorMsg = translated;
        }
      } catch {
        // fallback
      }
      this.logger.error(`MCP Tool ${toolName} falló para ${auth.actorType}:${actorId} (${durationMs}ms): ${rawMsg}`);
      return {
        isError: true,
        content: [{ type: "text", text: errorMsg }],
      };
    }
  }

  private async executeTool(
    name: McpToolName,
    args: Record<string, unknown>,
    auth: McpAuthContext,
  ): Promise<unknown> {
    switch (name) {
      case "events_list": {
        const list = await this.events.list(auth.userId!);
        const offset = Number(args.offset ?? 0);
        const limit = Number(args.limit ?? 50);
        const paged = list.slice(offset, offset + limit);
        return {
          total: list.length,
          offset,
          limit,
          events: paged.map((e) => ({
            id: e.id,
            title: e.title,
            slug: e.slug,
            date: e.date,
            timeZone: e.timeZone,
            location: e.location,
            theme: e.theme,
          })),
        };
      }

      case "events_get": {
        const eventId = String(args.id);
        const event = await this.events.event(auth.userId!, eventId);
        if (!event) {
          throw new Error(translate(auth.locale, mcpMessages.resourceNotFound));
        }
        const invitations = await this.events.invitations(auth.userId!, event.id);
        return {
          event,
          invitationsCount: invitations.length,
        };
      }

      case "events_attendance_summary": {
        const eventId = String(args.eventId);
        const event = await this.events.event(auth.userId!, eventId);
        if (!event) {
          throw new Error(translate(auth.locale, mcpMessages.resourceNotFound));
        }
        const invitations = await this.events.invitations(auth.userId!, event.id);
        let accepted = 0;
        let declined = 0;
        let pending = 0;
        let adults = 0;
        let children = 0;

        for (const inv of invitations) {
          for (const m of inv.members) {
            if (m.status === "accepted") accepted++;
            else if (m.status === "declined") declined++;
            else pending++;

            if (m.kind === "adult") adults++;
            else children++;
          }
        }

        return {
          eventId: event.id,
          eventTitle: event.title,
          totalInvitations: invitations.length,
          totalGuests: accepted + declined + pending,
          accepted,
          declined,
          pending,
          adults,
          children,
        };
      }

      case "providers_search": {
        const query = args.query ? String(args.query).trim() : null;
        const category = args.category ? String(args.category).trim() : null;
        const limit = Number(args.limit ?? 20);

        const sql = `
          SELECT provider_id, slug, business_name, headline, city, region, country, categories,
                 latitude, longitude, service_radius_km, price_from_cents, currency
          FROM provider_search
          WHERE ($1::text IS NULL OR business_name ILIKE '%' || $1 || '%' OR headline ILIKE '%' || $1 || '%')
            AND ($2::text IS NULL OR $2 = ANY(categories))
          ORDER BY updated_at DESC
          LIMIT $3
        `;
        const rows = await this.db.query<{
          provider_id: string;
          slug: string;
          business_name: string;
          headline: string;
          city: string;
          region: string;
          country: string;
          categories: string[];
          price_from_cents: number | null;
          currency: string | null;
        }>(sql, [query, category, limit]);

        return {
          resultsCount: rows.length,
          providers: rows.map((r) => ({
            id: r.provider_id,
            slug: r.slug,
            businessName: r.business_name,
            headline: r.headline,
            city: r.city,
            region: r.region,
            country: r.country,
            categories: r.categories,
            priceFromCents: r.price_from_cents,
            currency: r.currency,
          })),
        };
      }

      case "provider_profile_get": {
        const profile = await this.providers.profile(auth.userId!);
        if (!profile) {
          return { profile: null, status: "unconfigured" };
        }
        return { profile };
      }

      case "provider_services_list": {
        const profile = await this.providers.profile(auth.userId!);
        if (!profile) {
          return { services: [] };
        }
        const rows = await this.db.query<{
          id: string;
          title: string;
          description: string;
          price_from_cents: number | null;
          currency: string | null;
          price_unit: "event" | "hour" | "person" | "item" | "day" | null;
          position: number;
        }>(
          `SELECT id, title, description, price_from_cents, currency, price_unit, position
           FROM provider_services
           WHERE provider_id = $1
           ORDER BY position, created_at`,
          [profile.id],
        );
        return {
          services: rows.map((r) => ({
            id: r.id,
            title: r.title,
            description: r.description,
            price: r.price_from_cents !== null ? {
              fromCents: Number(r.price_from_cents),
              currency: r.currency,
              unit: r.price_unit,
            } : null,
          })),
        };
      }

      case "invitation_get": {
        let invitationId: string | undefined;
        if (auth.actorType === "guest") {
          invitationId = auth.invitationId;
        } else if (auth.actorType === "organizer") {
          invitationId = args.invitationId ? String(args.invitationId) : undefined;
        }

        if (!invitationId) {
          throw new Error("invitationId is required");
        }

        const invRows = await this.db.query<{
          id: string;
          event_id: string;
          name: string;
          kind: string;
          event_title: string;
          event_date: string;
          event_timezone: string;
          event_location: string;
          event_theme: string;
          event_user_id: string;
        }>(
          `SELECT i.id, i.event_id, i.name, i.kind,
                  e.title AS event_title, e.date AS event_date, e.time_zone AS event_timezone,
                  e.location AS event_location, e.theme AS event_theme, e.user_id AS event_user_id
           FROM invitations i
           JOIN events e ON e.id = i.event_id
           WHERE i.id = $1`,
          [invitationId],
        );

        if (!invRows.length) {
          throw new Error(translate(auth.locale, mcpMessages.resourceNotFound));
        }

        const inv = invRows[0];
        if (auth.actorType === "organizer" && inv.event_user_id !== auth.userId) {
          throw new Error(translate(auth.locale, mcpMessages.forbidden));
        }
        if (auth.actorType === "guest" && inv.id !== auth.invitationId) {
          throw new Error(translate(auth.locale, mcpMessages.forbidden));
        }

        const members = await this.db.query<{
          id: string;
          name: string;
          kind: string;
          status: string;
        }>(
          `SELECT id, name, kind, status FROM members WHERE invitation_id = $1 ORDER BY name`,
          [invitationId],
        );

        return {
          invitation: {
            id: inv.id,
            name: inv.name,
            kind: inv.kind,
            event: {
              title: inv.event_title,
              date: inv.event_date,
              timeZone: inv.event_timezone,
              location: inv.event_location,
              theme: inv.event_theme,
            },
            members,
          },
        };
      }

      case "invitation_rsvp_get": {
        const invitationId = auth.actorType === "guest" ? auth.invitationId : String(args.invitationId || "");
        if (!invitationId) throw new Error("invitationId is required");

        const members = await this.db.query<{
          id: string;
          name: string;
          kind: string;
          status: string;
        }>(
          `SELECT id, name, kind, status FROM members WHERE invitation_id = $1 ORDER BY name`,
          [invitationId],
        );
        return {
          invitationId,
          members,
        };
      }

      case "events_create": {
        const coords = args.coordinates as { lat: number; lng: number } | undefined;
        const event = await this.events.saveEvent(
          auth.userId!,
          {
            title: String(args.title),
            description: args.description ? String(args.description) : "",
            date: String(args.date),
            timeZone: String(args.timeZone || "UTC"),
            location: String(args.location),
            theme: args.theme as any,
            geo: coords ? { lat: coords.lat, lng: coords.lng } : null,
            slug: args.slug ? String(args.slug) : "",
            archived: false,
            cancelled: false,
          },
          undefined,
        );
        return { success: true, event };
      }

      case "events_update": {
        const eventId = String(args.id);
        const existing = await this.events.event(auth.userId!, eventId);
        if (!existing) {
          throw new Error(translate(auth.locale, mcpMessages.resourceNotFound));
        }
        const coords = args.coordinates as { lat: number; lng: number } | undefined;
        const updated = await this.events.saveEvent(
          auth.userId!,
          {
            title: args.title ? String(args.title) : existing.title,
            description: args.description !== undefined ? String(args.description) : (existing as any).description || "",
            date: args.date ? String(args.date) : existing.date,
            timeZone: args.timeZone ? String(args.timeZone) : existing.timeZone,
            location: args.location ? String(args.location) : existing.location,
            theme: (args.theme as any) || existing.theme,
            geo: coords !== undefined ? (coords ? { lat: coords.lat, lng: coords.lng } : null) : (existing as any).geo,
            slug: args.slug ? String(args.slug) : existing.slug,
            archived: existing.archived,
            cancelled: existing.cancelled,
          },
          existing.id,
        );
        return { success: true, event: updated };
      }

      case "invitations_create": {
        const event = await this.events.owned(auth.userId!, String(args.eventId));
        if (!event) {
          throw new Error(translate(auth.locale, mcpMessages.resourceNotFound));
        }
        const contact = args.contact ? String(args.contact) : "";
        const rawMembers = (args.members as any[]) || [];
        const inv = await this.events.saveInvitation(auth.userId!, event.id, {
          name: String(args.name),
          kind: args.kind as any,
          email: contact.includes("@") ? contact : "",
          phone: !contact.includes("@") ? contact : "",
          notes: "",
          members: rawMembers.map((m) => ({
            name: m.name,
            kind: m.kind,
            notes: "",
          })),
        });
        return { success: true, invitation: inv };
      }

      case "invitations_update": {
        const event = await this.events.owned(auth.userId!, String(args.eventId));
        if (!event) {
          throw new Error(translate(auth.locale, mcpMessages.resourceNotFound));
        }
        const contact = args.contact ? String(args.contact) : "";
        const rawMembers = (args.members as any[]) || [];
        const inv = await this.events.saveInvitation(
          auth.userId!,
          event.id,
          {
            name: args.name ? String(args.name) : "",
            kind: (args.kind as any) || "individual",
            email: contact.includes("@") ? contact : "",
            phone: !contact.includes("@") ? contact : "",
            notes: "",
            members: rawMembers.map((m) => ({
              id: m.id,
              name: m.name,
              kind: m.kind,
              notes: "",
            })),
          },
          String(args.id),
        );
        return { success: true, invitation: inv };
      }

      case "provider_profile_update": {
        const existing = await this.providers.profile(auth.userId!);
        const currentData = existing ? {
          businessName: existing.businessName,
          slug: existing.slug,
          headline: existing.headline,
          description: existing.description,
          categories: existing.categories,
          serviceRadiusKm: existing.serviceRadiusKm,
          address: existing.address,
          city: existing.city,
          region: existing.region,
          postalCode: existing.postalCode,
          phone: existing.phone,
          whatsapp: existing.whatsapp,
          publicEmail: existing.publicEmail,
          website: existing.website,
          instagramUrl: existing.instagramUrl,
          facebookUrl: existing.facebookUrl,
          tiktokUrl: existing.tiktokUrl,
          addressVisibility: existing.addressVisibility,
          country: existing.country || "MX",
          geo: existing.geo,
        } : {
          businessName: "",
          slug: "",
          headline: "",
          description: "",
          categories: [],
          serviceRadiusKm: 25,
          address: "",
          city: "",
          region: "",
          postalCode: "",
          country: "MX",
          phone: "",
          whatsapp: "",
          publicEmail: "",
          website: "",
          instagramUrl: "",
          facebookUrl: "",
          tiktokUrl: "",
          addressVisibility: "approximate" as const,
          geo: null,
        };

        const merged: any = {
          ...currentData,
          businessName: args.businessName !== undefined ? String(args.businessName) : currentData.businessName,
          slug: args.slug !== undefined ? String(args.slug) : currentData.slug,
          headline: args.headline !== undefined ? String(args.headline) : currentData.headline,
          description: args.description !== undefined ? String(args.description) : currentData.description,
          categories: args.categories !== undefined ? args.categories : currentData.categories,
          serviceRadiusKm: args.serviceRadiusKm !== undefined ? Number(args.serviceRadiusKm) : currentData.serviceRadiusKm,
          address: args.address !== undefined ? String(args.address) : currentData.address,
          city: args.city !== undefined ? String(args.city) : currentData.city,
          region: args.region !== undefined ? String(args.region) : currentData.region,
          postalCode: args.postalCode !== undefined ? String(args.postalCode) : currentData.postalCode,
          phone: args.phone !== undefined ? String(args.phone) : currentData.phone,
          whatsapp: args.whatsapp !== undefined ? String(args.whatsapp) : currentData.whatsapp,
          publicEmail: args.publicEmail !== undefined ? String(args.publicEmail) : currentData.publicEmail,
          website: args.website !== undefined ? String(args.website) : currentData.website,
          instagramUrl: args.instagramUrl !== undefined ? String(args.instagramUrl) : currentData.instagramUrl,
          facebookUrl: args.facebookUrl !== undefined ? String(args.facebookUrl) : currentData.facebookUrl,
          tiktokUrl: args.tiktokUrl !== undefined ? String(args.tiktokUrl) : currentData.tiktokUrl,
        };

        if (args.coordinates !== undefined) {
          const coords = args.coordinates as { lat: number; lng: number } | null;
          merged.geo = coords ? { lat: coords.lat, lng: coords.lng } : null;
        }

        const updated = await this.providers.saveProfile(auth.userId!, merged);
        return { success: true, profile: updated };
      }

      case "provider_services_update": {
        const action = String(args.action);
        if (action === "create") {
          const created = await this.providers.createService(auth.userId!, {
            title: String(args.title),
            description: args.description ? String(args.description) : "",
            price: (args.price as any) || null,
          });
          return { success: true, action: "create", service: created };
        }
        if (action === "update") {
          const serviceId = String(args.serviceId);
          const updated = await this.providers.updateService(auth.userId!, serviceId, {
            title: String(args.title),
            description: args.description ? String(args.description) : "",
            price: (args.price as any) || null,
          });
          return { success: true, action: "update", service: updated };
        }
        if (action === "delete") {
          const serviceId = String(args.serviceId);
          await this.providers.removeService(auth.userId!, serviceId);
          return { success: true, action: "delete", serviceId };
        }
        throw new Error(`Invalid action: ${action}`);
      }

      case "invitation_rsvp_update": {
        const invitationId = auth.actorType === "guest" ? auth.invitationId : String(args.invitationId || "");
        if (!invitationId) throw new Error("invitationId is required");

        const members = args.members as Array<{ id: string; status: "accepted" | "declined" | "pending" }>;
        // Verificar pertenencia estricta de todos los miembros a esta invitación
        const check = await this.db.query<{ id: string }>(
          `SELECT id FROM members WHERE invitation_id = $1`,
          [invitationId],
        );
        const validMemberIds = new Set(check.map((r) => r.id));

        for (const m of members) {
          if (!validMemberIds.has(m.id)) {
            throw new Error(translate(auth.locale, mcpMessages.forbidden));
          }
        }

        for (const m of members) {
          await this.db.query(
            `UPDATE members SET status = $1 WHERE id = $2 AND invitation_id = $3`,
            [m.status, m.id, invitationId],
          );
        }

        const updatedMembers = await this.db.query<{
          id: string;
          name: string;
          kind: string;
          status: string;
        }>(
          `SELECT id, name, kind, status FROM members WHERE invitation_id = $1 ORDER BY name`,
          [invitationId],
        );
        return {
          success: true,
          invitationId,
          members: updatedMembers,
        };
      }

      default:
        throw new Error(`Unhandled tool: ${name}`);
    }
  }
}
