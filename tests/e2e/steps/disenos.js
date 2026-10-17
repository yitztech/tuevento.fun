import { expect } from '@playwright/test';
import { themes, translate } from '@tuevento/contracts';
import { Given, When, Then, nuevaCuenta } from './fixtures.js';

const hermanas = themes.filter(t => 'smallImage' in t);
const headers = { 'x-tuevento-client': '1' };

async function sinDesbordamiento(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

Given('que abro el catálogo de postales con una cuenta nueva a {int} por {int}', async ({ page }, width, height) => {
  await page.setViewportSize({ width, height });
  const registro = await page.request.post('/api/auth/register', { headers, data: nuevaCuenta() });
  expect(registro.status()).toBe(201);
  await page.goto('/disenos');
  await expect(page.getByRole('heading', { name: 'Invitaciones con personalidad.' })).toBeVisible();
});

Then('las dieciséis postales cargan sin desbordamiento horizontal', async ({ page }) => {
  await expect(page.locator('.template-card')).toHaveCount(16);
  await expect(page.getByText('16 diseños para celebrar', { exact: true })).toBeVisible();
  for (const imagen of await page.locator('.template-card img').all()) {
    await imagen.scrollIntoViewIfNeeded();
    await expect(imagen).toHaveJSProperty('complete', true);
    expect(await imagen.evaluate(i => i.naturalWidth)).toBeGreaterThan(0);
  }
  await sinDesbordamiento(page);
});

Then('puedo abrir la vista previa de cada postal hermana', async ({ page }) => {
  for (const tema of hermanas) {
    const nombre = translate('es', tema.name);
    await page.getByRole('button', { name: `Vista previa de ${nombre}`, exact: true }).click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.locator(`.invitation-art.theme-${tema.id}`)).toBeVisible();
    await expect(modal.getByRole('link', { name: 'Crear evento con este diseño' })).toHaveAttribute('href', `/eventos/nuevo?tema=${tema.id}`);
    await sinDesbordamiento(page);
    await modal.getByRole('button', { name: 'Cerrar', exact: true }).click();
  }
});

When('elijo una postal invernal y guardo un evento', async ({ page, ctx }) => {
  await page.getByRole('link', { name: 'Usar Invernal', exact: true }).click();
  await expect(page).toHaveURL(/\/eventos\/nuevo\?tema=winter$/);
  const seleccion = page.locator('.theme-picker').getByRole('button', { name: 'Invernal', exact: true });
  await expect(seleccion).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.theme-choice')).toHaveCount(16);
  await page.getByLabel('Nombre del evento', { exact: true }).fill('Encuentro invernal de prueba');
  await page.getByLabel('Fecha y hora', { exact: true }).fill('2027-12-12T17:00');
  await page.getByLabel('¿Dónde nos vemos?', { exact: true }).fill('Lugar de prueba');
  await sinDesbordamiento(page);
  const respuesta = page.waitForResponse(r => r.url().endsWith('/api/events') && r.request().method() === 'POST');
  await page.locator('button[type="submit"]').click();
  const creada = await respuesta;
  expect(creada.status()).toBe(201);
  ctx.eventoPostal = await creada.json();
  expect(ctx.eventoPostal.theme).toBe('winter');
  await expect(page).toHaveURL(new RegExp(`/eventos/${ctx.eventoPostal.id}$`));
});

Then('el evento conserva el diseño invernal al volver a editarlo', async ({ page, ctx }) => {
  const id = ctx.eventoPostal.id;
  try {
    await page.reload();
    await page.getByRole('link', { name: 'Editar evento', exact: true }).click();
    await expect(page.locator('.theme-picker').getByRole('button', { name: 'Invernal', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.preview-panel .invitation-art.theme-winter')).toBeVisible();
    await sinDesbordamiento(page);
  } finally {
    await page.request.delete(`/api/events/${id}`, { headers });
  }
});
