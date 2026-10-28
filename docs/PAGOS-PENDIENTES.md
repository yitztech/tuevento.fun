# Pagos: estado y pendientes (27-oct-2026)

Ya está la maqueta de pagos: el flujo completo funciona contra un doble de Stripe que hace de pasarela falsa, sin cuentas reales. Está subida a la rama `fix/seguridad-abuso` (commit `ccc7188`). En producción no cambia nada hasta que se definan las claves de Stripe: sin ellas no se cobra ni se limita nada.

## Cómo funciona

- **Dónde se paga:** el detalle de cada evento muestra si está en el plan gratuito o en un tramo pagado, con un enlace a `/pago`. Ahí se elige el tramo y se paga en Stripe Checkout.
- **Cambio de tramo:** pasar a un tramo mayor cobra solo la diferencia.
- **Cuándo cuenta el pago:** solo cuando llega el aviso firmado de Stripe (webhook). Volver del navegador no basta.
- **Evento pagado:** sus invitados reciben los avisos por correo, y el número de invitados queda topado en el máximo de su tramo, también en las invitaciones abiertas.
- **Plan gratuito:** incluye todo menos los correos a invitados.
- **Demostración:** sus eventos no se pueden pagar.

## Supuestos que tomé (cámbialos si no te sirven)

- El proveedor es **Stripe**.
- Los precios van en **USD**, porque así están ya en la página de precios.
- Dentro de la app móvil, el pago se abre en el navegador, y la vuelta tras pagar llega a la web, no a la app.

## Pruebas

Todas pasan en local.

| Suite | Resultado |
|---|---|
| unit | 78 |
| api | 23 |
| endpoints | 26 |
| security | 28 |
| db | 35 |
| e2e | 578/578, sin fallidos, omitidos ni inestables |

Squawk no marca nada en la migración nueva. Al probar salieron dos fallos que ya corregí: la vuelta desde el pago caía en la pantalla de inicio de sesión, y en iPhone no se abría la página del doble.

## Lo que necesito del equipo de infraestructura

Antes de desplegar lo ya hecho (fases 1–3):

1. **`APP_SECRET` en Coolify**, de 32 caracteres aleatorios o más. Sin ella la API no arranca.

Para los pagos, cuando tengas la cuenta de Stripe:

2. **`STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET`** como secretos del entorno de producción, y estos dos nombres añadidos a la tabla de variables de la plataforma. Si se pone la primera sin la segunda, la API no arranca.
3. **Webhook accesible desde internet:** `https://tuevento.fun/api/payments/webhook` tiene que recibir las peticiones de Stripe a través de Traefik y del gateway.
   - Ningún WAF ni límite de peticiones debe bloquear las IP de Stripe.
   - El cuerpo de la petición tiene que llegar intacto, sin recomprimir ni recodificar, porque la firma se calcula sobre el texto exacto.
4. **Salida a internet desde el contenedor `api`** hacia `api.stripe.com:443`.
5. **Alertas** cuando el webhook responda 400 o cuando aparezca en los logs «No se pudo abrir el pago».

Para el correo:

6. **SPF, DKIM y DMARC** en `tuevento.fun` y `yourevent.fun`. Gmail y Yahoo los exigen para que los avisos no acaben en spam.
7. **Avisos de rebotes y quejas de spam** del proveedor de SMTP (un webhook o un buzón). Es lo que falta para dar de baja automáticamente las direcciones que rebotan.

No hacen falta contenedores nuevos en producción: el doble de Stripe solo existe en las pruebas. Las migraciones 023 a 026 se aplican solas al arrancar la API. Tampoco hay que tocar la política de seguridad de contenido (CSP), porque Checkout es una redirección a la página de Stripe.

## Pendiente para mañana, con la cuenta de Stripe

- [ ] Crear el webhook en el panel de Stripe, con los eventos `checkout.session.completed` y `checkout.session.async_payment_succeeded`.
- [ ] Poner las claves de prueba (`sk_test_…`).
- [ ] Hacer un pago real de prueba.
- [ ] Pasar a las claves de producción.
