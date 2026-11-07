// Las cuentas nuevas confirman su correo antes de usar la app: lee el enlace que llega a Mailpit.
const mailpit = process.env.TEST_MAILPIT_URL || "http://127.0.0.1:8026";

async function confirmationToken(email) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const list = await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`).then((r) => r.json());
    for (const { ID } of list.messages ?? []) {
      const message = await fetch(`${mailpit}/api/v1/message/${ID}`).then((r) => r.json());
      const token = /\/confirmar-correo\?token=([\w-]{43})/.exec(message.Text)?.[1];
      if (token) return token;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`No llegó a ${email} el correo de confirmación`);
}

module.exports = { confirmationToken };
