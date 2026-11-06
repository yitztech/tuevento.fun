# language: es
@registro @proveedores @REQ-PROV-02
Característica: Cuenta de organizador, de proveedor o de agencia
  Tras confirmar el correo se elige si se organizan eventos, se ofrecen servicios para ellos o se
  es una agencia. Cada tipo de cuenta ve su propio espacio.

  @movil @smoke
  Escenario: Elegir proveedor lleva a su negocio, sin eventos
    Dado que abro la página de registro
    Cuando relleno el registro con datos válidos
    Y envío el formulario de registro
    Y confirmo mi correo con el enlace que recibí
    Y elijo la opción "Soy proveedor de servicios para eventos"
    Entonces la opción "Soy proveedor de servicios para eventos" está elegida
    Cuando continúo con el registro
    Entonces veo la bienvenida "Haz que te encuentren"
    Y veo el enlace "Mi negocio" en el menú
    Y no veo el enlace "Mis eventos" en el menú

  @movil
  Escenario: Una agencia usa el mismo espacio que quien organiza eventos
    Dado que abro la página de registro
    Cuando relleno el registro con datos válidos
    Y envío el formulario de registro
    Y confirmo mi correo con el enlace que recibí
    Y elijo la opción "Soy agencia organizadora de eventos"
    Y continúo con el registro
    Entonces veo la bienvenida "Tu agencia, lista para trabajar"
    Y veo el enlace "Mis eventos" en el menú
    Y no veo el enlace "Mi negocio" en el menú

  # La portada no existe dentro de las apps: arrancan en el acceso. El tipo de cuenta se elige
  # después de confirmar el correo, en los escenarios de arriba.
  @solo-web
  Escenario: Desde la portada, el botón para proveedores lleva al registro
    Dado que abro la portada
    Cuando pulso el enlace "Crear mi cuenta de proveedor"
    Entonces estoy en la página de registro

  @movil
  Escenario: Un proveedor que abre la página de eventos vuelve a su negocio
    Dado que tengo una cuenta de proveedor con la sesión abierta
    Cuando abro la página "/eventos"
    Entonces estoy en "/negocio"
    Y veo el enlace "Mi negocio" en el menú
