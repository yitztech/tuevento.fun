import {
  Controller,
  Get,
  Post,
  Delete,
  Req,
  Res,
  Body,
  Headers,
  HttpCode,
  Param,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import type { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { parse } from "../problem";
import { Database } from "../database";
import { AuthService } from "../auth";
import { tokenLookup } from "../tokens";
import { requestLocale } from "../request-locale";
import { McpOAuth, mcpTestMode } from "./mcp.oauth";
import { McpService, mcpProtocolVersions } from "./mcp.service";
import { createMcpToken, revokeMcpToken, verifyMcpToken } from "./mcp.tokens";
import type { JsonRpcRequest } from "./mcp.types";
import { type McpScope, mcpMessages, translate } from "@tuevento/contracts";

@Controller("mcp")
export class McpController {
  constructor(
    private db: Database,
    private auth: AuthService,
    private mcp: McpService,
    private oauth: McpOAuth,
  ) {}

  /** Endpoint principal de Model Context Protocol (Streamable HTTP y JSON-RPC 2.0). */
  @Post()
  @HttpCode(200)
  async handleMcp(
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
    @Body() body: unknown,
    @Headers("authorization") authHeader?: string,
  ) {
    const locale = requestLocale(req);

    // 1. Autenticación por Bearer token
    if (!authHeader?.startsWith("Bearer ")) {
      reply.header("WWW-Authenticate", this.oauth.challenge(req));
      reply.status(401);
      return reply.send({
        jsonrpc: "2.0",
        id: (body as JsonRpcRequest)?.id ?? null,
        error: { code: -32001, message: translate(locale, mcpMessages.unauthorized) },
      });
    }

    const token = authHeader.slice(7).trim();
    const authContext = token.startsWith("mcp_")
      ? await verifyMcpToken(this.db, token, locale)
      : await this.oauth.verify(req, token, locale);
    if (!authContext) {
      reply.header("WWW-Authenticate", this.oauth.challenge(req, "invalid_token"));
      reply.status(401);
      return reply.send({
        jsonrpc: "2.0",
        id: (body as JsonRpcRequest)?.id ?? null,
        error: { code: -32001, message: translate(locale, mcpMessages.invalidToken) },
      });
    }

    // 2. Procesamiento de la solicitud JSON-RPC
    const rpcReq = body as JsonRpcRequest;
    if (!rpcReq || typeof rpcReq !== "object") {
      reply.status(400);
      return reply.send({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error: expected JSON object" },
      });
    }

    // Una notificación no lleva `id` ni respuesta
    if (rpcReq.id === undefined && rpcReq.method?.startsWith("notifications/")) return reply.status(202).send();

    const response = await this.mcp.handleJsonRpc(rpcReq, authContext);

    // 3. Negociación de transporte: Streamable HTTP (SSE) vs JSON simple
    const accept = req.headers.accept || "";
    if (accept.includes("text/event-stream")) {
      reply.raw.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.raw.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
      return reply.raw.end();
    }

    return reply.status(200).send(response);
  }

  @Get()
  async getStatus(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    // Sin avisos del servidor: no hay canal SSE que abrir con GET
    if ((req.headers.accept || "").includes("text/event-stream")) return reply.status(405).send();
    return reply.status(200).send({
      status: "ok",
      service: "tuevento-mcp",
      protocolVersion: mcpProtocolVersions[0],
      transports: ["streamable-http", "json-rpc-post"],
    });
  }

  @Delete()
  @HttpCode(204)
  async deleteSession() {
    return;
  }

  /** Solo pruebas (`MCP_TEST_MODE`): token directo para la sesión, sin pasar por OAuth. */
  @Post("tokens")
  @HttpCode(200)
  async createTestToken(
    @Req() req: FastifyRequest,
    @Body() body: { client_name?: string; scopes?: McpScope[] },
  ) {
    if (!mcpTestMode()) throw new NotFoundException();
    const user = await this.auth.current(req);

    const scopes: McpScope[] = Array.isArray(body?.scopes) && body.scopes.length > 0
      ? body.scopes.filter((s) => s === "mcp:read" || s === "mcp:write")
      : ["mcp:read", "mcp:write"];

    const created = await createMcpToken(this.db, {
      actorType: user.accountType,
      userId: user.id,
      clientName: body?.client_name || "MCP Client",
      scopes,
    });

    return {
      access_token: created.token,
      token_type: "Bearer",
      expires_at: created.expiresAt.toISOString(),
      actor_type: user.accountType,
      scopes,
    };
  }

  /** Revoca un token de invitado o de pruebas. */
  @Post("tokens/revoke")
  @HttpCode(200)
  async revoke(@Body() body: { token?: string }) {
    if (!body?.token || typeof body.token !== "string") {
      throw new BadRequestException("token is required");
    }
    const revoked = await revokeMcpToken(this.db, body.token);
    return { revoked };
  }

  /** Concede un token breve y delimitado para un invitado a partir de su enlace de invitación. */
  @Post("guest-token")
  @HttpCode(200)
  async createGuestToken(
    @Body() body: { invitation_token?: string; client_name?: string },
  ) {
    if (!body?.invitation_token || typeof body.invitation_token !== "string") {
      throw new BadRequestException("invitation_token is required");
    }

    const tokenHash = tokenLookup(body.invitation_token);
    const rows = await this.db.query<{ id: string }>(
      `SELECT id FROM invitations WHERE token_hash = $1`,
      [tokenHash],
    );

    if (!rows.length) {
      throw new NotFoundException("Invitation not found");
    }

    const scopes: McpScope[] = mcpTestMode() ? ["mcp:read", "mcp:write"] : ["mcp:read"];
    const created = await createMcpToken(this.db, {
      actorType: "guest",
      invitationId: rows[0].id,
      clientName: body?.client_name || "MCP Guest Client",
      scopes,
      expiresInSeconds: 2 * 3600, // 2 horas
    });

    return {
      access_token: created.token,
      token_type: "Bearer",
      expires_at: created.expiresAt.toISOString(),
      actor_type: "guest",
      scopes,
    };
  }
}

/** Descubrimiento del recurso protegido (RFC 9728); el gateway lo sirve en `/.well-known/`. */
@Controller(".well-known")
export class McpDiscoveryController {
  constructor(private oauth: McpOAuth) {}

  @Get("oauth-protected-resource")
  protectedResource(@Req() req: FastifyRequest) {
    const metadata = this.oauth.protectedResource(req);
    if (!metadata) throw new NotFoundException();
    return metadata;
  }
}

/** Pantalla de consentimiento: la abre el navegador durante la autorización de un cliente MCP. */
@Controller("mcp/oauth/interaction")
export class McpConsentController {
  constructor(
    private auth: AuthService,
    private oauth: McpOAuth,
  ) {}

  /** Entrada desde `oidc-provider`: la cookie del paso solo viaja a estas rutas. */
  @Get(":uid")
  open(@Param("uid") uid: string, @Res() reply: FastifyReply) {
    return reply.redirect(`/conectar-asistente?uid=${encodeURIComponent(uid)}`, 303);
  }

  @Get(":uid/details")
  async details(@Req() req: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.account(req);
    return this.oauth.consent(req, reply);
  }

  @Post(":uid/decision")
  @HttpCode(200)
  async decision(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Body() body: unknown,
  ) {
    const user = await this.account(req);
    const { allow } = parse(z.strictObject({ allow: z.boolean() }), body, req);
    return { redirectTo: await this.oauth.decide(req, reply, user.id, allow) };
  }

  private async account(req: FastifyRequest) {
    const user = await this.auth.current(req);
    if (user.isDemo) throw new ForbiddenException();
    return user;
  }
}
