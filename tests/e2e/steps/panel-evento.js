import { When } from "./fixtures.js";

When("abro el modo pantalla de mi evento", async ({ page, ctx }) => {
  await page.goto(`/eventos/${ctx.evento.id}/pantalla`);
});
