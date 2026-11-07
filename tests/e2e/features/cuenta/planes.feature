# language: es
@planes @REQ-05
Característica: Elegir un plan y llegar a su página de pago
  La página de planes muestra una tarjeta por plan, en dos pestañas. Elegir un plan de pago lleva a
  /planes/pago con su resumen. El cobro aún no está conectado: los datos de la tarjeta y el botón de
  pagar siguen desactivados hasta integrar Stripe.

  @solo-lectura @smoke
  Escenario: Los planes de eventos particulares muestran sus invitados y su precio en dólares
    Dado que abro la página de precios
    Entonces el plan "Gratis" muestra "$0"
    Y el plan "Gratis" muestra "Hasta 20 invitados"
    Y el plan "Esencial" muestra "$14.99"
    Y el plan "Esencial" muestra "21 – 60 invitados"
    Y el plan "Premium" muestra "$29.99"
    Y el plan "Gran Evento" muestra "$99.99"
    Y el plan "Gran Evento" muestra "Más de 500 invitados"

  @solo-lectura
  Escenario: El plan Premium se destaca como el más popular
    Dado que abro la página de precios
    Entonces el plan "Premium" muestra "Más popular"

  @solo-lectura
  Escenario: Cada plan dice lo que incluye
    Dado que abro la página de precios
    Entonces el plan "Gratis" muestra "Página del evento"
    Y el plan "Plus" muestra "Todo lo del plan Esencial"
    Y el plan "Premium" muestra "Código QR de acceso"

  @solo-lectura
  Escenario: Los planes profesionales son una suscripción mensual
    Dado que abro la página de precios
    Cuando abro la pestaña "Profesionales"
    Entonces el plan "Starter" muestra "$19.99"
    Y el plan "Business" muestra "$39.99"
    Y el plan "Agency" muestra "$79.99"
    Y el plan "Agency" muestra "por mes"

  @solo-lectura @smoke
  Escenario: Elegir un plan lleva a su página de pago con el resumen
    Dado que abro la página de precios
    Cuando elijo el plan "Premium"
    Entonces estoy en la página de pago del plan "premium"
    Y veo el aviso "Completa tu compra"
    Y el resumen de la compra muestra "Premium"
    Y el resumen de la compra muestra "101 – 200 invitados"
    Y el resumen de la compra muestra "USD · Pago único"
    Y el total a pagar es "$29.99 USD"

  @solo-lectura
  Escenario: Elegir un plan profesional lleva a pagar su suscripción mensual
    Dado que abro la página de precios
    Cuando abro la pestaña "Profesionales"
    Y elijo el plan "Business"
    Entonces estoy en la página de pago del plan "business"
    Y el resumen de la compra muestra "USD · Suscripción mensual"
    Y el total a pagar es "$39.99 USD"

  @solo-lectura
  Escenario: Desde la página de pago se vuelve a los planes
    Cuando abro "/planes/pago?plan=plus" en el dominio en "es"
    Y pulso el enlace "Volver a los planes"
    Entonces estoy en la página de planes

  @solo-lectura @validacion
  Esquema del escenario: Sin un plan de pago válido se vuelve a los planes
    Cuando abro "<ruta>" en el dominio en "es"
    Entonces estoy en la página de planes

    Ejemplos:
      | ruta                     |
      | /planes/pago             |
      | /planes/pago?plan=nada   |
      | /planes/pago?plan=free   |

  # La tarjeta no pasa por campos propios: al integrar Stripe la recogerá su Payment Element
  @solo-lectura
  Escenario: Mientras el cobro no esté conectado no se pueden escribir los datos de la tarjeta ni pagar
    Cuando abro "/planes/pago?plan=premium" en el dominio en "es"
    Entonces los datos de la tarjeta no se pueden escribir
    Y el botón "Pagar $29.99 USD" está desactivado
    Y veo el aviso "El cobro todavía no está conectado. Cuando esté disponible, aquí podrás pagar tu evento."

  @solo-lectura
  Escenario: Elegir PayPal oculta los datos de la tarjeta
    Cuando abro "/planes/pago?plan=premium" en el dominio en "es"
    Y elijo pagar con "PayPal"
    Entonces no veo los datos de la tarjeta

  # Stripe aún sin integrar: se salta (@pendiente) hasta conectarlo
  @pendiente
  Escenario: Pagar un plan confirma la compra
    Cuando abro "/planes/pago?plan=premium" en el dominio en "es"
    Y pago con una tarjeta de prueba
    Entonces veo el aviso "Pago recibido. Tus invitados ya reciben los avisos por correo."

  @solo-lectura @i18n
  Esquema del escenario: La página de pago está en el idioma de su ruta
    Cuando abro "<ruta>" en el dominio en "<idioma>"
    Entonces veo el aviso "<titulo>"

    Ejemplos:
      | idioma | ruta                                | titulo                  |
      | es     | /planes/pago?plan=premium           | Completa tu compra      |
      | en     | /plans/checkout?plan=premium        | Complete your purchase  |
      | en     | /pt/planos/pagamento?plan=premium   | Conclua sua compra      |
      | en     | /de/plaene/zahlung?plan=premium     | Schließe deinen Kauf ab |
      | en     | /fr/plans/paiement?plan=premium     | Finalise ton achat      |
