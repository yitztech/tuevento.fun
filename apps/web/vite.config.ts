import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Componentes de shadcn/ui y sus utilidades (packages/app/components.json)
      "@": fileURLToPath(new URL("../../packages/app/src", import.meta.url)),
      "@tuevento/contracts": fileURLToPath(
        new URL("../../packages/contracts/src/index.ts", import.meta.url),
      ),
      "@tuevento/client": fileURLToPath(
        new URL("../../packages/client/src/index.ts", import.meta.url),
      ),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5187,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      "/api": {
        target: process.env.API_PROXY || "http://127.0.0.1:3087",
        changeOrigin: false,
      },
    },
  },
  build: { chunkSizeWarningLimit: 650 },
  // Solo el build de pruebas de las apps (scripts/mobile-test-*.sh) lleva el interruptor
  // «simular sin conexión»; en cualquier otro build vale false y el código desaparece.
  define: { __PRUEBAS__: JSON.stringify(process.env.VITE_TEST_BUILD === "1") },
});
