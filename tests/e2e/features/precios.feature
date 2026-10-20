# language: es
@precios @REQ-05
Característica: Precios del servicio

  @solo-lectura @smoke
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

  @solo-lectura
  Escenario: Cada tramo muestra su precio con signo de dólar y dos decimales
    Dado que abro la página de precios
    Entonces veo el aviso "$5.00"
    Y veo el aviso "$30.00"

  @solo-lectura
  Escenario: El botón de compra lleva a crear la cuenta
    Dado que abro la página de precios
    Cuando pulso el enlace "Comprar" de la portada
    Entonces estoy en la página de registro
