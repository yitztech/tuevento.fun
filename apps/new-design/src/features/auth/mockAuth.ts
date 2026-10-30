// Simulación local de las llamadas de acceso. No hay servidor: el prototipo no inventa endpoints.
// Cuando exista la API real, estas tres funciones se sustituyen por llamadas al cliente.
const wait = (ms = 700) => new Promise((r) => setTimeout(r, ms));

export async function simulateLogin(): Promise<{ ok: false }> {
  await wait();
  return { ok: false };
}

export async function simulateRegister(): Promise<{ ok: true }> {
  await wait();
  return { ok: true };
}

/** Responde igual exista o no la cuenta (no revela si un correo está registrado). */
export async function simulateRecover(): Promise<{ ok: true }> {
  await wait();
  return { ok: true };
}

export async function simulateNewsletter(): Promise<{ ok: true }> {
  await wait(500);
  return { ok: true };
}
