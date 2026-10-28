import test from "node:test";
import assert from "node:assert/strict";
import {
  type Locale,
  mcpActorToolMatrix,
  mcpMessages,
  mcpToolNames,
  mcpToolScopeMatrix,
  mcpToolSchemas,
  translate,
} from "@tuevento/contracts";
import {
  checkIdempotency,
  generateConfirmationToken,
  getToolsForActor,
  saveIdempotency,
  stripConfirmationFields,
  toolDescriptions,
  verifyConfirmationToken,
} from "./mcp/mcp.tools";

test("MCP: esquema de herramientas valida entradas correctas y rechaza campos inválidos", () => {
  // events_create
  const validEvent = {
    title: "Boda de Mariana y Carlos",
    date: "2026-11-20T18:00:00Z",
    timeZone: "America/Mexico_City",
    location: "Hacienda San José, Cuernavaca",
    theme: "gold",
    description: "Celebración especial",
    coordinates: { lat: 18.92, lng: -99.23 },
  };
  assert.ok(mcpToolSchemas.events_create.safeParse(validEvent).success);
  assert.equal(
    mcpToolSchemas.events_create.safeParse({ ...validEvent, title: "No" }).success,
    false,
    "Título demasiado corto",
  );
  assert.equal(
    mcpToolSchemas.events_create.safeParse({ ...validEvent, theme: "inexistente" }).success,
    false,
    "Tema inválido",
  );

  // invitations_create
  const validInv = {
    eventId: "e123",
    name: "Familia Pérez",
    kind: "family",
    contact: "5512345678",
    members: [
      { name: "Juan", kind: "adult" },
      { name: "Ana", kind: "child" },
    ],
  };
  assert.ok(mcpToolSchemas.invitations_create.safeParse(validInv).success);
  assert.equal(
    mcpToolSchemas.invitations_create.safeParse({ ...validInv, members: [] }).success,
    false,
    "Invitación sin integrantes",
  );

  // provider_services_update
  const validService = {
    action: "create",
    title: "Banquete gourmet 3 tiempos",
    description: "Entrada, plato fuerte y postre con maridaje",
    price: { fromCents: 45000, currency: "MXN", unit: "person" },
  };
  assert.ok(mcpToolSchemas.provider_services_update.safeParse(validService).success);
  assert.equal(
    mcpToolSchemas.provider_services_update.safeParse({ ...validService, action: "invalida" }).success,
    false,
    "Acción inválida",
  );

  // invitation_rsvp_update
  const validRsvp = {
    members: [
      { id: "00000000-0000-4000-8000-000000000001", status: "accepted" },
      { id: "00000000-0000-4000-8000-000000000002", status: "declined" },
    ],
  };
  assert.ok(mcpToolSchemas.invitation_rsvp_update.safeParse(validRsvp).success);
  assert.equal(
    mcpToolSchemas.invitation_rsvp_update.safeParse({ members: [] }).success,
    false,
    "RSVP sin integrantes",
  );
});

test("MCP: matriz de permisos aísla estrictamente organizadores, proveedores e invitados", () => {
  const orgTools = getToolsForActor("organizer", ["mcp:read", "mcp:write"], "es").map((t) => t.name);
  const provTools = getToolsForActor("provider", ["mcp:read", "mcp:write"], "es").map((t) => t.name);
  const guestTools = getToolsForActor("guest", ["mcp:read", "mcp:write"], "es").map((t) => t.name);

  // Organizador: puede ver sus eventos y buscar proveedores, NO puede ver/editar perfil ni servicios de proveedor
  assert.ok(orgTools.includes("events_list"));
  assert.ok(orgTools.includes("events_create"));
  assert.ok(orgTools.includes("providers_search"));
  assert.ok(!orgTools.includes("provider_profile_get"));
  assert.ok(!orgTools.includes("provider_services_list"));
  assert.ok(!orgTools.includes("provider_profile_update"));

  // Proveedor: solo su perfil y servicios; NO ve eventos, invitaciones ni invitados
  assert.ok(provTools.includes("provider_profile_get"));
  assert.ok(provTools.includes("provider_services_list"));
  assert.ok(provTools.includes("provider_profile_update"));
  assert.ok(provTools.includes("provider_services_update"));
  assert.ok(!provTools.includes("events_list"));
  assert.ok(!provTools.includes("events_create"));
  assert.ok(!provTools.includes("invitations_create"));
  assert.ok(!provTools.includes("invitation_rsvp_get"));

  // Invitado: solo su invitación y su RSVP; NO ve lista general de eventos ni proveedores
  assert.ok(guestTools.includes("invitation_get"));
  assert.ok(guestTools.includes("invitation_rsvp_get"));
  assert.ok(guestTools.includes("invitation_rsvp_update"));
  assert.ok(!guestTools.includes("events_list"));
  assert.ok(!guestTools.includes("events_create"));
  assert.ok(!guestTools.includes("providers_search"));
  assert.ok(!guestTools.includes("provider_profile_get"));
});

test("MCP: permisos por ámbito (scope) ocultan herramientas de escritura si solo hay lectura", () => {
  const readOnlyOrg = getToolsForActor("organizer", ["mcp:read"], "es").map((t) => t.name);
  assert.ok(readOnlyOrg.includes("events_list"));
  assert.ok(readOnlyOrg.includes("events_get"));
  assert.ok(readOnlyOrg.includes("providers_search"));
  assert.ok(!readOnlyOrg.includes("events_create"));
  assert.ok(!readOnlyOrg.includes("events_update"));
  assert.ok(!readOnlyOrg.includes("invitations_create"));

  const writeOnlyGuest = getToolsForActor("guest", ["mcp:write"], "es").map((t) => t.name);
  assert.ok(writeOnlyGuest.includes("invitation_rsvp_update"));
  assert.ok(!writeOnlyGuest.includes("invitation_get"));
  assert.ok(!writeOnlyGuest.includes("invitation_rsvp_get"));
});

test("MCP: tokens de confirmación criptográfica HMAC para vista previa y dry-run", () => {
  process.env.APP_SECRET = "dev-secret-key-32-chars-long-minimum-length";
  const actorId = "user-123";
  const tool = "events_create";
  const params = { title: "Evento Test", date: "2026-12-01T20:00:00Z" };

  // Genera token válido
  const { confirmationToken, expiresAt } = generateConfirmationToken(actorId, tool, params, 600);
  assert.ok(confirmationToken);
  assert.ok(expiresAt.getTime() > Date.now());

  // Verifica con los mismos parámetros exactos
  assert.equal(verifyConfirmationToken(confirmationToken, actorId, tool, params), true);

  // Falla si cambian los parámetros
  assert.equal(
    verifyConfirmationToken(confirmationToken, actorId, tool, { ...params, title: "Alterado" }),
    false,
  );

  // Falla si cambia el actor
  assert.equal(verifyConfirmationToken(confirmationToken, "otro-actor", tool, params), false);

  // Falla si cambia la herramienta
  assert.equal(verifyConfirmationToken(confirmationToken, actorId, "events_update", params), false);

  // Falla con token caducado (TTL negativo)
  const expired = generateConfirmationToken(actorId, tool, params, -10).confirmationToken;
  assert.equal(verifyConfirmationToken(expired, actorId, tool, params), false);
});

test("MCP: idempotencia recuerda el resultado de la misma clave y detecta conflictos", () => {
  const key = `idem-${Date.now()}`;
  const args = { title: "Mi Evento", location: "Salón Imperial" };
  const result = { success: true, id: "event-456" };

  assert.equal(checkIdempotency(key, args).hit, false);

  saveIdempotency(key, args, result);

  // Misma clave y mismos parámetros: hit idéntico
  const hit = checkIdempotency(key, args);
  assert.equal(hit.hit, true);
  assert.deepEqual(hit.result, result);

  // Misma clave con parámetros distintos: conflicto
  const conflict = checkIdempotency(key, { ...args, location: "Otro lugar" });
  assert.equal(conflict.hit, false);
  assert.equal(conflict.conflict, true);
});

test("MCP: mensajes de error y descripciones en los cinco idiomas", () => {
  const locales: Locale[] = ["es", "en", "pt", "de", "fr"];

  for (const locale of locales) {
    // Todos los mensajes de MCP traducidos
    const unauth = translate(locale, mcpMessages.unauthorized);
    const forb = translate(locale, mcpMessages.forbidden);
    const conf = translate(locale, mcpMessages.confirmationRequired);
    const scope = translate(locale, mcpMessages.scopeRequired, { scope: "mcp:write" });
    const prev = translate(locale, mcpMessages.previewSummary, { tool: "events_create" });

    assert.ok(unauth && !unauth.includes("mcp."), `${locale}: unauthorized`);
    assert.ok(forb && !forb.includes("mcp."), `${locale}: forbidden`);
    assert.ok(conf && !conf.includes("mcp."), `${locale}: confirmationRequired`);
    assert.ok(scope.includes("mcp:write"), `${locale}: scope variable`);
    assert.ok(prev.includes("events_create"), `${locale}: preview tool variable`);

    // Todas las herramientas tienen descripción en el idioma
    for (const tool of mcpToolNames) {
      const desc = toolDescriptions[tool][locale];
      assert.ok(desc && desc.length > 5, `${locale}: descripción de ${tool}`);
    }
  }
});
