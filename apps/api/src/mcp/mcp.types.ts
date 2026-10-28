import type { Locale, McpActorType, McpScope, McpToolName } from "@tuevento/contracts";

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
}

export interface McpServerInfo {
  name: string;
  version: string;
}

export interface McpCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  logging?: Record<string, unknown>;
}

export interface McpInitializeResult {
  protocolVersion: string;
  capabilities: McpCapabilities;
  serverInfo: McpServerInfo;
}

export interface McpToolDefinition {
  name: McpToolName;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolCallResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}

export interface McpAuthContext {
  actorType: McpActorType;
  userId?: string;
  invitationId?: string;
  clientName: string;
  scopes: McpScope[];
  locale: Locale;
}
