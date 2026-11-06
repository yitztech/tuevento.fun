# language: es
@plataforma @sesion @seguridad @api @solo-web
Característica: Seguridad del acceso y de las sesiones
  El acceso no revela qué cuentas existen, frena los intentos repetidos y cierra la sesión de verdad.
  Es lo que exige AGENTS.md §24; la API responde igual aunque la petición no venga del formulario.

  # @solo-web: las pruebas hablan con la API del dominio web por HTTP; en la app del emulador no aplica.

  @smoke @BE-24
  Escenario: Una contraseña incorrecta y un correo inexistente reciben la misma respuesta
    Dado que tengo una cuenta creada por la API sin sesión en el navegador
    Cuando intento entrar con mi correo y una contraseña incorrecta
    Y intento entrar con un correo que no existe
    Entonces ambos intentos responden 401 con el mismo código y el mismo mensaje

  @BE-24
  Escenario: Tras varios fallos seguidos la cuenta se frena con Retry-After
    Dado que tengo una cuenta creada por la API sin sesión en el navegador
    Cuando intento entrar 6 veces con mi correo y una contraseña incorrecta
    Entonces el último intento responde 429 con Retry-After
    Y entrar con la contraseña correcta también responde 429

  @BE-24
  Escenario: La sesión se cierra de verdad y su cookie ya no sirve
    Dado que tengo una cuenta con la sesión abierta en la API
    Cuando guardo la cookie de mi sesión
    Y cierro la sesión por la API
    Entonces la API no me reconoce con la cookie guardada

  @BE-24
  Escenario: Cada acceso estrena una sesión distinta
    Dado que tengo una cuenta creada por la API sin sesión en el navegador
    Cuando entro dos veces con mi correo y mi contraseña
    Entonces las dos sesiones tienen cookies distintas
    Y las dos siguen abiertas

  @BE-24
  Escenario: La cookie de sesión caduca como máximo a los 7 días
    Dado que tengo una cuenta creada por la API sin sesión en el navegador
    Cuando entro con mi correo y mi contraseña por la API
    Entonces la cookie de sesión caduca en 7 días como máximo

  @BE-24
  Escenario: El acceso no devuelve contraseñas, hashes ni tokens en el cuerpo
    Dado que tengo una cuenta creada por la API sin sesión en el navegador
    Cuando entro con mi correo y mi contraseña por la API
    Entonces el cuerpo de la respuesta no incluye datos secretos

  @BE-24 @solo-lectura
  Esquema del escenario: Sin sesión, lo privado responde 401
    Cuando pido "<ruta>" sin sesión
    Entonces la API responde 401

    Ejemplos:
      | ruta         |
      | /api/auth/me |
      | /api/events  |
      | /api/notifications |

  @BE-24 @solo-lectura
  Escenario: Una escritura sin la cabecera propia se rechaza
    Cuando envío un cierre de sesión sin la cabecera propia
    Entonces la API responde 403 con el código "origin_not_allowed"

  @BE-24 @solo-lectura
  Escenario: Una escritura desde un origen ajeno se rechaza
    Cuando envío un cierre de sesión desde el origen "https://sitio-ajeno.example"
    Entonces la API responde 403 con el código "origin_not_allowed"

  @BE-24
  Escenario: Una sesión usada antes de las 72 horas sigue abierta
    Dado que tengo una cuenta con la sesión abierta en la API
    Cuando mi sesión lleva 71 horas sin usarse
    Y pido mi cuenta con mi sesión
    Entonces la API responde 200

  @BE-24
  Escenario: Una sesión sin usar durante 72 horas caduca
    Dado que tengo una cuenta con la sesión abierta en la API
    Cuando mi sesión lleva 73 horas sin usarse
    Y pido mi cuenta con mi sesión
    Entonces la API responde 401

  @BE-24
  Escenario: Cerrar todas las sesiones las cierra en todos los dispositivos
    Dado que tengo una cuenta con la sesión abierta en la API
    Cuando abro otra sesión en otro dispositivo
    Y cierro todas mis sesiones
    Entonces la API no me reconoce en ningún dispositivo

  @BE-24
  Escenario: Cambiar la contraseña cierra las demás sesiones y anula la anterior
    Dado que tengo una cuenta con la sesión abierta en la API
    Cuando abro otra sesión en otro dispositivo
    Y cambio mi contraseña por la API
    Entonces la API responde 200
    Y la sesión del otro dispositivo ya no sirve
    Y mi sesión sigue abierta
    Y la contraseña anterior ya no entra
    Y la contraseña nueva entra

  @BE-24 @validacion
  Escenario: Cambiar la contraseña exige la actual
    Dado que tengo una cuenta con la sesión abierta en la API
    Cuando cambio mi contraseña por la API con una actual incorrecta
    Entonces la API responde 422
    Y el error del campo "currentPassword" tiene el código "invalid_current_password"

  @BE-24
  Escenario: Un registro nuevo sustituye a una cuenta sin confirmar
    Dado un registro válido para la API
    Cuando lo envío a la API de registro
    Y alguien lo repite con el mismo correo y otra contraseña
    Entonces la API responde 201
    Y la primera contraseña ya no entra

  @BE-24
  Escenario: Una cuenta confirmada no se sustituye con otro registro
    Dado que tengo una cuenta creada por la API sin sesión en el navegador
    Cuando alguien se registra con mi correo y otra contraseña
    Entonces la API responde 409
