# Planes de precios: estado y continuación

Estado (6-nov-2026): la página pública `/planes` (antes `/precios`) ya muestra los planes nuevos con su diseño final (PR #82), **sin aviso de vista previa**. Solo cambió lo que se ve (`personalPlans` y `agencyPlans` en `packages/contracts/src/pricing.ts`): el cobro en `packages/app/src/pricing.tsx`, `apps/api/src/payments.ts` y la tabla `event_payments` siguen con los tramos anteriores (`guestTiers`). Hoy la página y el cobro no coinciden: no se debe habilitar el cobro, ni anunciar estos precios como vigentes, hasta que el cobro y las reglas de invitados coincidan con ellos. Los tests de Stripe están saltados hasta integrarlo (ver `docs/PAGOS-PENDIENTES.md`).

## Decisiones del usuario

- Personas, USD por evento: Gratis hasta 20; Esencial 21–60 por 14,99; Plus 61–100 por 19,99; Premium 101–200 por 29,99; Celebración 201–500 por 49,99; Gran Evento desde 501 por 99,99.
- Profesionales, USD al mes: Starter 19,99; Business 39,99; Agency 79,99. Mostrar precios; los límites y funciones permanecen pendientes de definir. No implementar privilegios, promesas ni cobros de suscripción hasta tener sus condiciones.
- Los eventos y pagos anteriores conservan sus condiciones. No reinterpretar `event_payments.tier` existente con una nueva tabla de índices.

## Pendiente para que los planes por evento sean contratables

1. Diseñar una versión persistida del plan por evento, incluyendo un corte seguro para eventos anteriores, pagos pendientes, webhooks retrasados y sesiones de Checkout existentes. Preservar límites y condiciones históricas y registrar importes en centavos; no alterar registros contables para adaptarlos al nuevo catálogo.
2. Actualizar contratos, validación, restricciones SQL y migraciones con `NOT VALID` cuando corresponda, autorización por propietario, API, límites de invitados, cupones, ampliaciones, mensajes y pantalla de pago web/móvil. El límite gratuito actual no coincide con los 20 invitados de la propuesta.
3. Decidir la experiencia cuando Stripe no esté configurado: el usuario no debe quedar atrapado al llegar al límite sin un modo disponible de contratar. No habilitar cobros hasta tener infraestructura y políticas operativas verificadas.
4. Agregar pruebas de límites 20/21, 60/61, 100/101, 200/201 y 500/501; importes exactos, descuentos, actualizaciones, concurrencia, webhooks repetidos, pagos históricos y pendientes, autorización por recurso y paridad de cinco idiomas. Ejecutar suites de API, base de datos y E2E con el simulador de Stripe; después validar Stripe en modo de pruebas con su webhook y, antes de publicar, las tareas operativas de `docs/PAGOS-PENDIENTES.md`.
5. Implementar suscripciones profesionales solo cuando se definan límites y prestaciones, incluyendo ciclo de vida, cancelación, impago, derechos y migración. Hasta entonces, valorar un aviso en la página de que los planes aún no se pueden contratar.

## Verificación

Antes del rediseño final, con los tramos anteriores, pasaron la suite API (24 comprobaciones), la de endpoints (42) y la de seguridad (35) contra un Compose aislado con `services/payments-fake`. Esos resultados cubren el contrato de precios anterior; no prueban los nuevos precios ni Stripe real.
