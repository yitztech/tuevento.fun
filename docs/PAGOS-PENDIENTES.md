# Pagos: estado y pendientes (3-nov-2026)

El flujo completo de pagos y cupones funciona contra un doble de Stripe (`services/payments-fake`), sin cuentas reales. Nunca se ha probado contra Stripe de verdad. En producción no cambia nada hasta que se definan las claves de Stripe: sin ellas no se cobra ni se limita nada.

## Cómo funciona

- **Dónde se paga:** el detalle de cada evento muestra si está en el plan gratuito o en un tramo pagado, con un enlace a `/pago`. Ahí se elige el tramo y se paga en Stripe Checkout.
- **Cambio de tramo:** pasar a un tramo mayor cobra solo la diferencia.
- **Cuándo cuenta el pago:** solo cuando llega el aviso firmado de Stripe (webhook). Volver del navegador no basta.
- **Evento pagado:** sus invitados reciben los avisos por correo, y el número de invitados queda topado en el máximo de su tramo, también en las invitaciones abiertas.
- **Plan gratuito:** incluye todo menos los correos a invitados.
- **Demostración:** sus eventos no se pueden pagar.
- **Intentos sin cobrar:** una sesión de Stripe caduca a los 31 minutos. Al caducar, o si se rechaza un pago diferido, el pago pasa a `canceled` y se libera su cupón.
- **Un intento abierto por evento:** abrir otro pago cierra la sesión anterior, para que no se cobre dos veces. Si esa sesión ya se completó y falta su webhook, responde 409 hasta que llegue.
- **Cobros sin pago abierto:** si Stripe cobra una sesión que no coincide con ningún pago pendiente, la API lo registra como error (`Stripe cobró la sesión …`). Revísalo y reembólsalo a mano.

## Cupones

- **Son propios, no los de Stripe:** la API calcula el importe y Stripe cobra ese importe. Así el organizador ve el precio antes de pagar y el webhook sigue comprobando que el importe es el que abrió la API.
- **Dónde se gestionan:** en la pestaña «Cupones» del panel de administración. Se crean y se desactivan; no se borran. Cada cambio queda en `admin_audit_log`.
- **Qué descuentan:** un porcentaje o una cantidad en dólares, sobre lo que se cobraría; al subir de tramo, sobre la diferencia.
- **Límites:** caducidad y máximo de usos opcionales, y un uso por cuenta. Un pago pendiente reserva el uso hasta que su sesión caduca.
- **Cobro mínimo:** si el descuento deja menos de $1.00, se cobra $1.00 (`MIN_CHARGE_CENTS`). Stripe exige un mínimo que depende de la moneda en la que liquida la cuenta: 0.50 USD o 10 MXN.
- **Cupón del 100 %:** el pago queda confirmado sin pasar por Stripe, con importe 0.

## Supuestos que tomé (cámbialos si no te sirven)

- Los precios van en **USD**, porque así están ya en la página de precios.
- Dentro de la app móvil, el pago se abre en el navegador, y la vuelta tras pagar llega a la web, no a la app.
- **Reembolsos y disputas** se hacen a mano en el panel de Stripe, y el evento sigue pagado: la API no atiende esos eventos.
- **Impuestos y facturas** no están resueltos: la API no calcula IVA ni emite facturas. Decídelo con tu contador antes de cobrar.
- **iOS:** el pago de un servicio digital fuera de la app puede chocar con las reglas de Apple. Revísalo antes de publicar la app de iOS, hoy aparcada.

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

No hacen falta contenedores nuevos en producción: el doble de Stripe solo existe en las pruebas. Las migraciones se aplican solas al arrancar la API. Tampoco hay que tocar la política de seguridad de contenido (CSP), porque Checkout es una redirección a la página de Stripe.

## Probar en local con Stripe de verdad

Solo con claves de prueba (`sk_test_…`): no se mueve dinero.

1. Instala la [CLI de Stripe](https://docs.stripe.com/stripe-cli) y entra con `stripe login`.
2. Reenvía los webhooks a la pila de desarrollo. El comando imprime el secreto `whsec_…`:

   ```bash
   stripe listen --forward-to localhost:5187/api/payments/webhook \
     --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired
   ```

3. Pon `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` en `.env`, nunca en un archivo versionado, y reinicia con `docker compose up -d api`.
4. Paga un evento con estas [tarjetas de prueba](https://docs.stripe.com/testing), con cualquier fecha futura y cualquier CVC:

   | Tarjeta | Resultado |
   |---|---|
   | `4242 4242 4242 4242` | Pago correcto |
   | `4000 0025 0000 3155` | Pide autenticación 3D Secure |
   | `4000 0000 0000 0002` | Rechazada |

5. Comprueba: el evento queda pagado, el idioma de la página de Stripe es el del sitio, un cupón baja el importe en Stripe y repetir un pago con el mismo cupón caduca la sesión anterior.

## Pendiente, con la cuenta de Stripe

- [ ] Crear la cuenta y completar sus datos de negocio y de cobro.
- [ ] Hacer la prueba local de arriba.
- [ ] Dejar activos solo métodos de pago inmediatos (tarjeta, Apple Pay, Google Pay). La reserva de un cupón dura 35 minutos: con un método diferido, como una transferencia, otra cuenta podría gastar el último uso antes de que se confirme.
- [ ] Crear en Stripe el webhook de `https://tuevento.fun/api/payments/webhook`, con la versión de API `2026-10-28.endive` y los eventos `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` y `checkout.session.expired`.
- [ ] Poner las claves de producción en Coolify (puntos 2 a 5 de arriba).
- [ ] Hacer un pago real pequeño con un cupón y reembolsarlo desde Stripe.
