import test from "node:test";
import assert from "node:assert/strict";
import {
  invitationSchema,
  rsvpSchema,
  registerSchema,
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
      username: "ana",
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
  const {
    normalizeLocale,
    translateMessage,
    notificationMessage,
    englishMessages,
    themes,
  } = await import("./index");
  assert.equal(normalizeLocale("en-GB,en;q=0.9"), "en");
  assert.equal(normalizeLocale("fr"), "es");
  assert.equal(normalizeLocale(), "es");
  assert.equal(
    translateMessage("Escribe un correo válido.", "en"),
    "Enter a valid email address.",
  );
  assert.equal(
    translateMessage("Fiesta privada de María", "en"),
    "Fiesta privada de María",
  );
  assert.equal(
    notificationMessage({ accepted: 1, declined: 2, pending: 3 }, "en"),
    "1 attending, 2 not attending and 3 pending.",
  );
  assert.equal(
    notificationMessage({ accepted: 1, declined: 1, pending: 0 }, "es"),
    "1 confirmado, 1 no asistirá y 0 en espera.",
  );
  for (const theme of themes) assert.ok(englishMessages[theme.name]);
});

test("Las traducciones conservan todas las variables de interpolación", async () => {
  const { englishMessages } = await import("./index");
  for (const [key, value] of Object.entries(englishMessages)) {
    const variables = (text: string) =>
      [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();
    assert.deepEqual(variables(value), variables(key), key);
  }
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
  const {
    forgotPasswordSchema,
    resetPasswordSchema,
    translateMessage,
    englishMessages,
  } = await import("./index");
  assert.deepEqual(forgotPasswordSchema.parse({ email: "Ana@Example.com" }), {
    email: "ana@example.com",
  });
  const token = "A".repeat(43);
  assert.equal(resetPasswordSchema.safeParse({ token, password: "x".repeat(10) }).success, true);
  assert.equal(resetPasswordSchema.safeParse({ token, password: "corta" }).success, false);
  assert.equal(
    resetPasswordSchema.safeParse({ token: "a/b", password: "x".repeat(10) }).success,
    false,
  );
  for (const message of [
    "El enlace para cambiar la contraseña no es válido o caducó.",
    "Si ese correo tiene una cuenta, te enviamos un enlace para elegir una contraseña nueva. Revisa también la carpeta de spam.",
    "¡Gracias! Revisa tu correo para confirmar la suscripción.",
  ])
    assert.ok(englishMessages[message], message);
  assert.equal(
    translateMessage("El enlace para cambiar la contraseña no es válido o caducó.", "en"),
    "The password reset link is invalid or has expired.",
  );
});
