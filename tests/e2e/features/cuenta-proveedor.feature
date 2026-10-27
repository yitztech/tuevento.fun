# language: es
@registro @proveedores @REQ-PROV-02
Característica: Cuenta de organizador o de proveedor
  Al registrarse se elige si se organizan eventos o se ofrecen servicios para ellos. Cada tipo de
  cuenta ve su propio espacio.

  @solo-web @smoke
  Escenario: Registrarse como proveedor lleva a su negocio, sin eventos
    Dado que abro la página de registro
    Cuando elijo la opción "Ofrezco servicios para eventos"
    Y relleno el registro con datos válidos
    Y envío el formulario de registro
    Entonces entro a mi espacio
    Y veo el enlace "Mi negocio" en el menú
    Y no veo el enlace "Mis eventos" en el menú

  @solo-web
  Escenario: Sin elegir, la cuenta es de organizador y no ve «Mi negocio»
    Dado que abro la página de registro
    Cuando relleno el registro con datos válidos
    Y envío el formulario de registro
    Entonces entro a mi espacio
    Y veo el enlace "Mis eventos" en el menú
    Y no veo el enlace "Mi negocio" en el menú

  @solo-web
  Escenario: Desde la portada, el registro llega con «Ofrezco servicios» elegido
    Dado que abro la portada
    Cuando pulso el enlace "Crear mi cuenta de proveedor"
    Entonces la opción "Ofrezco servicios para eventos" está elegida

  @solo-web
  Escenario: Un proveedor que abre la página de eventos vuelve a su negocio
    Dado que tengo una cuenta de proveedor con la sesión abierta
    Cuando abro la página "/eventos"
    Entonces estoy en "/app"
    Y veo el enlace "Mi negocio" en el menú
