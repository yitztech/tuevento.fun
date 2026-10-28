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
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import type { FastifyRequest, FastifyReply } from "fastify";
import { Database } from "../database";
import { AuthService } from "../auth";
import { tokenLookup } from "../tokens";
import { requestLocale } from "../request-locale";
import { siteUrl } from "../locale-env";
import { McpService } from "./mcp.service";
import { createMcpToken, revokeMcpToken, verifyMcpToken } from "./mcp.tokens";
import type { JsonRpcRequest } from "./mcp.types";
import { type McpScope, mcpMessages, translate } from "@tuevento/contracts";

@Controller("mcp")
export class McpController {
  constructor(
    private db: Database,
    private auth: AuthService,
    private mcp: McpService,
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
      reply.header("WWW-Authenticate", 'Bearer error="unauthorized"');
      reply.status(401);
      return reply.send({
        jsonrpc: "2.0",
        id: (body as JsonRpcRequest)?.id ?? null,
        error: { code: -32001, message: translate(locale, mcpMessages.unauthorized) },
      });
    }

    const token = authHeader.slice(7).trim();
    const authContext = await verifyMcpToken(this.db, token, locale);
    if (!authContext) {
      reply.header("WWW-Authenticate", 'Bearer error="invalid_token"');
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
    const accept = req.headers.accept || "";
    if (accept.includes("text/event-stream")) {
      reply.raw.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.raw.write(`event: ping\ndata: {}\n\n`);
      return reply.raw.end();
    }
    return reply.status(200).send({
      status: "ok",
      service: "tuevento-mcp",
      protocolVersion: "2024-11-05",
      transports: ["streamable-http", "json-rpc-post"],
    });
  }

  @Delete()
  @HttpCode(204)
  async deleteSession() {
    return;
  }

  /** Metadatos de servidor de autorización RFC 8414 para clientes MCP. */
  @Get("oauth/metadata")
  getMetadata(@Req() req: FastifyRequest) {
    const locale = requestLocale(req);
    const base = `${siteUrl(locale)}/api/mcp`;
    return {
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/oauth/token`,
      revocation_endpoint: `${base}/oauth/revoke`,
      response_types_supported: ["token"],
      scopes_supported: ["mcp:read", "mcp:write"],
      token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    };
  }

  /** Concede un token MCP para un organizador o proveedor con sesión iniciada. */
  @Post("oauth/authorize")
  @HttpCode(200)
  async authorize(
    @Req() req: FastifyRequest,
    @Body() body: { client_name?: string; scopes?: McpScope[] },
  ) {
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

  /** Revoca un token MCP previamente emitido. */
  @Post("oauth/revoke")
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

    const created = await createMcpToken(this.db, {
      actorType: "guest",
      invitationId: rows[0].id,
      clientName: body?.client_name || "MCP Guest Client",
      scopes: ["mcp:read", "mcp:write"],
      expiresInSeconds: 2 * 3600, // 2 horas
    });

    return {
      access_token: created.token,
      token_type: "Bearer",
      expires_at: created.expiresAt.toISOString(),
      actor_type: "guest",
      scopes: ["mcp:read", "mcp:write"],
    };
  }
}
