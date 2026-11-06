# language: es
@precios @REQ-05
Característica: Precios del servicio

  @solo-lectura @smoke
  Escenario: Los precios se ven sin registrarse
    Dado que abro la página de precios
    Entonces veo la pestaña "Eventos particulares" seleccionada
    Y veo la pestaña "Profesionales"

  # Stripe aún sin integrar: se salta (@pendiente) hasta conectarlo
  @demo @pendiente
  Escenario: Dentro de la demostración, el botón de pago está resaltado y lleva a la página de pago
    Dado que tengo una cuenta creada y entro a mi espacio
    Cuando exploro la demostración
    Entonces veo el botón destacado "Pagar el servicio"
    Cuando pulso el botón destacado "Pagar el servicio"
    Entonces estoy en la página de pago
    # Con los pagos conectados (el doble de Stripe en las pruebas) la página lista los eventos para pagar
    Y veo el aviso "Elige el evento que quieres pagar"

  @solo-lectura
  Escenario: Los planes de personas muestran sus invitados y su precio en dólares
    Dado que abro la página de precios
    Entonces la tabla "Eventos particulares" tiene la fila "Gratis | Hasta 20 | $0"
    Y la tabla "Eventos particulares" tiene la fila "Esencial | 21–60 | $14.99"
    Y la tabla "Eventos particulares" tiene la fila "Premium | 101–200 | $29.99"
    Y la tabla "Eventos particulares" tiene la fila "Gran Evento | 501 o más | $99.99"

  @solo-lectura
  Escenario: Los planes de agencias son una suscripción mensual
    Dado que abro la página de precios
    Cuando abro la pestaña "Profesionales"
    Entonces la tabla "Profesionales" tiene la fila "Starter | $19.99"
    Y la tabla "Profesionales" tiene la fila "Business | $39.99"
    Y la tabla "Profesionales" tiene la fila "Agency | $79.99"

  @solo-lectura
  Escenario: El botón de compra lleva a crear la cuenta
    Dado que abro la página de precios
    Cuando pulso el enlace "Comprar ahora" de la portada
    Entonces estoy en la página de registro
