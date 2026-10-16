# language: es
@precios
Característica: Precios del servicio

  Escenario: Los precios se ven sin registrarse
    Dado que abro la página de precios
    Entonces veo el aviso "Hasta 50 invitados"
    Y veo el aviso "Más de 150 invitados"

  @demo
  Escenario: Dentro de la demostración, el botón de pago está resaltado y lleva a la página de pago
    Dado que tengo una cuenta creada y entro a mi espacio
    Cuando exploro la demostración
    Entonces veo el botón destacado "Pagar el servicio"
    Cuando pulso el botón destacado "Pagar el servicio"
    Entonces estoy en la página de pago
    Y veo el aviso "El cobro todavía no está conectado."
