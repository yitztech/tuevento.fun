// Genera el valor de ADMIN_PASSWORD_HASH. La contraseña entra por la entrada estándar,
// así no queda en el historial de la shell:
//   printf '%s' 'la-contraseña' | npm run hash-password -w @tuevento/admin
import { hashPassword } from "../src/password.mjs";

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const password = Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
if (password.length < 12) {
  console.error("La contraseña debe tener al menos 12 caracteres.");
  process.exit(1);
}
console.log(await hashPassword(password));
