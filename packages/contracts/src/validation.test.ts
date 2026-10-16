import test from "node:test";
import assert from "node:assert/strict";
import {
  invitationSchema,
  rsvpSchema,
  registerSchema,
  loginSchema,
  eventSchema,
  countMetrics,
} from "./index";
const member = { name: "Ana López", kind: "adult", notes: "" } as const;
test("Una invitación requiere contacto e integrante", () => {
  assert.equal(
    invitationSchema.safeParse({ kind: "individual", members: [member] })
      .success,
    false,
  );
  assert.equal(
    invitationSchema.safeParse({ name: "Ana", kind: "individual", members: [] })
      .success,
    false,
  );
  assert.equal(
    invitationSchema.safeParse({
      email: "ana@example.com",
      kind: "individual",
      members: [member],
    }).success,
    true,
  );
});
test("Individual rechaza varios miembros; familiar los acepta", () => {
  assert.equal(
    invitationSchema.safeParse({
      name: "Familia",
      kind: "individual",
      members: [member, member],
    }).success,
    false,
  );
  assert.equal(
    invitationSchema.safeParse({
      name: "Familia",
      kind: "family",
      members: [member, member],
    }).success,
    true,
  );
});
test("RSVP rechaza miembros repetidos y estados desconocidos", () => {
  const id = "169114d1-50a2-4626-9d18-10b1d047804f";
  assert.equal(
    rsvpSchema.safeParse({
      members: [
        { id, status: "accepted" },
        { id, status: "pending" },
      ],
    }).success,
    false,
  );
  assert.equal(
    rsvpSchema.safeParse({ members: [{ id, status: "yes" }] }).success,
    false,
  );
});
test("Métricas cuentan personas, edad y estado individual", () => {
  assert.deepEqual(
    countMetrics([
      {
        members: [
          { kind: "adult", status: "accepted" },
          { kind: "child", status: "pending" },
          { kind: "adult", status: "declined" },
        ],
      },
    ]),
    {
      invitations: 1,
      people: 3,
      adults: 2,
      children: 1,
      accepted: 1,
      pending: 1,
      declined: 1,
    },
  );
});
test("Registro exige contraseña y contacto válidos", () => {
  assert.equal(
    registerSchema.safeParse({
      firstName: "Ana",
      lastName: "López",
      email: "mal",
      phone: "x",
      password: "123",
    }).success,
    false,
  );
});
test("Evento exige fecha ISO, zona horaria real y tema soportado", () => {
  const e = {
    title: "Fiesta de Ana",
    date: "2026-12-12T23:00:00Z",
    location: "Jardín",
    theme: "floral",
    timeZone: "America/Mexico_City",
  };
  assert.equal(eventSchema.safeParse(e).success, true);
  assert.equal(
    eventSchema.safeParse({ ...e, timeZone: "Zona/Inexistente" }).success,
    false,
  );
  assert.equal(eventSchema.safeParse({ ...e, date: "mañana" }).success, false);
});

test("Idiomas admitidos, fallback y traducción sin alterar texto propio", async () => {
  const { normalizeLocale, translateMessage, notificationMessage, translate, themes } =
    await import("./index");
  assert.equal(normalizeLocale("en-GB,en;q=0.9"), "en");
  assert.equal(normalizeLocale("fr-CA"), "fr");
  assert.equal(normalizeLocale("it"), "es");
  assert.equal(normalizeLocale(), "es");
  assert.equal(
    translateMessage("validation.enterValidEmailAddress", "en"),
    "Enter a valid email address.",
  );
  assert.equal(
    translateMessage("validation.enterValidEmailAddress", "es"),
    "Escribe un correo válido.",
  );
  // El contenido de los usuarios no es una clave: se devuelve intacto
  assert.equal(translateMessage("Fiesta privada de María", "en"), "Fiesta privada de María");
  assert.equal(translateMessage("common", "en"), "common");
  assert.equal(
    notificationMessage({ accepted: 1, declined: 2, pending: 3 }, "en"),
    "1 attending, 2 not attending and 3 pending.",
  );
  assert.equal(
    notificationMessage({ accepted: 1, declined: 1, pending: 0 }, "es"),
    "1 confirmado, 1 no asistirá y 0 en espera.",
  );
  assert.equal(
    notificationMessage({ accepted: 2, declined: 0, pending: 1 }, "es"),
    "2 confirmados, 0 no asistirán y 1 en espera.",
  );
  assert.equal(translate("es", "common.peopleCount", { count: 1 }), "1 persona");
  assert.equal(translate("en", "common.peopleCount", { count: 3 }), "3 people");
  assert.equal(translate("en", "events.memberNumber", { number: 2 }), "Member 2");
  for (const theme of themes) assert.notEqual(translate("en", theme.name), theme.name);
});

test("La validación genérica responde por idioma sin cambiar el locale global", async () => {
  const { validationOptions } = await import("./index");
  const en = registerSchema.safeParse({}, validationOptions("en"));
  const es = registerSchema.safeParse({}, validationOptions("es"));
  assert.equal(en.success, false);
  assert.equal(es.success, false);
  if (!en.success && !es.success) {
    assert.match(en.error.issues[0].message, /Invalid input/);
    assert.notEqual(en.error.issues[0].message, es.error.issues[0].message);
  }
});

test("Recuperar contraseña: correo normalizado, token de 43 caracteres y mensajes traducidos", async () => {
  const { forgotPasswordSchema, resetPasswordSchema, translate } = await import("./index");
  assert.deepEqual(forgotPasswordSchema.parse({ email: "Ana@Example.com" }), {
    email: "ana@example.com",
  });
  const token = "A".repeat(43);
  assert.equal(resetPasswordSchema.safeParse({ token, password: "x".repeat(10) }).success, true);
  assert.equal(resetPasswordSchema.safeParse({ token, password: "corta" }).success, false);
  const invalid = resetPasswordSchema.safeParse({ token: "a/b", password: "x".repeat(10) });
  assert.equal(invalid.success, false);
  if (!invalid.success) {
    // Las validaciones devuelven la clave; la API y la app la traducen
    assert.equal(invalid.error.issues[0].message, "common.passwordResetLinkInvalid");
    assert.equal(
      translate("en", "common.passwordResetLinkInvalid"),
      "The password reset link is invalid or has expired.",
    );
  }
});
const newUser = {
  firstName: "María José",
  lastName: "O'Connor-Núñez",
  email: "ana@example.com",
  phone: "+52 (55) 1234-5678",
  password: "una-clave-larga-1",
};
test("Registro acepta nombres con acentos, apóstrofo y guion", () => {
  assert.equal(registerSchema.safeParse(newUser).success, true);
});
test("Registro rechaza números y símbolos en nombre y apellidos", () => {
  for (const value of ["Ana2", "123", "Ana_López", "Ana@", "<b>Ana</b>"]) {
    assert.equal(registerSchema.safeParse({ ...newUser, firstName: value }).success, false, value);
    assert.equal(registerSchema.safeParse({ ...newUser, lastName: value }).success, false, value);
  }
});
test("Registro rechaza letras y teléfonos sin dígitos suficientes", () => {
  for (const value of ["abc1234567", "555-CALL-NOW", "+++++++", "123456", "1234567890123456"]) {
    assert.equal(registerSchema.safeParse({ ...newUser, phone: value }).success, false, value);
  }
});
test("Registro limita la longitud de nombre, correo, teléfono y contraseña", () => {
  const long = (n: number, c = "a") => c.repeat(n);
  const ok = (patch: object) => registerSchema.safeParse({ ...newUser, ...patch }).success;
  assert.equal(ok({ firstName: long(50) }), true);
  assert.equal(ok({ firstName: long(51) }), false);
  assert.equal(ok({ lastName: long(51) }), false);
  assert.equal(ok({ email: `${long(243)}@example.com` }), false);
  assert.equal(ok({ phone: "1".repeat(21) }), false);
  assert.equal(ok({ password: long(128) }), true);
  assert.equal(ok({ password: long(129) }), false);
});
test("Inicio de sesión aplica las mismas reglas de correo y contraseña que el registro", () => {
  const login = { email: "ana@example.com", password: "una-clave-larga-1" };
  const ok = (patch: object) => loginSchema.safeParse({ ...login, ...patch }).success;
  assert.equal(ok({}), true);
  assert.equal(ok({ password: "x".repeat(9) }), false);
  assert.equal(ok({ password: "x".repeat(10) }), true);
  assert.equal(ok({ password: "x".repeat(128) }), true);
  assert.equal(ok({ password: "x".repeat(129) }), false);
  assert.equal(ok({ password: "" }), false);
  assert.equal(ok({ email: "no-es-correo" }), false);
  assert.equal(ok({ email: `${"a".repeat(243)}@example.com` }), false);
  for (const password of ["x".repeat(9), "x".repeat(129)]) {
    const r = loginSchema.safeParse({ ...login, password });
    assert.equal(r.success, false);
    assert.equal(r.error?.issues[0].path[0], "password");
  }
});

test("El registro ya no pide nombre de usuario", () => {
  assert.equal(registerSchema.safeParse(newUser).success, true);
  assert.equal("username" in registerSchema.shape, false);
});
