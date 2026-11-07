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
  Escenario: El plan gratis lleva a crear la cuenta
    Dado que abro la página de precios
    Cuando pulso el enlace "Comenzar gratis" de la portada
    Entonces estoy en la página de registro
