# language: es
@proteccion @solo-web @REQ-03
Característica: Landing protegida por contraseña y dirección sugerida
  La contraseña es otra forma de entrar a la landing para quien no tiene enlace personal.

  Escenario: Sin enlace personal, una landing protegida solo se abre con la contraseña
    Dado que tengo un evento con dirección pública y contraseña "clave-de-prueba"
    Cuando abro la página pública del evento sin sesión
    Entonces veo el encabezado "Evento protegido"
    Cuando escribo la contraseña "mal"
    Y pulso "Ver el evento"
    Entonces veo el aviso "La contraseña no es correcta."
    Cuando escribo la contraseña "clave-de-prueba"
    Y pulso "Ver el evento"
    Entonces veo el encabezado con el título del evento

  @validacion
  Escenario: El organizador ve que alguien prueba contraseñas en su página protegida
    Dado que tengo un evento con dirección pública y contraseña "clave-de-prueba"
    Y que alguien prueba 3 contraseñas equivocadas en la página del evento
    Cuando abro la edición del evento
    Entonces veo el aviso "Alguien probó contraseñas equivocadas 3 veces desde el último acceso correcto. Si no fueron tú ni tus invitados, cámbiala."

  Escenario: La página pública del evento pide no indexarse
    Dado que tengo un evento con dirección pública
    Cuando abro la página pública del evento
    Entonces la página pide no indexarla

  Escenario: Al escribir el nombre del evento se sugiere su dirección pública
    Dado que tengo una cuenta creada y abro un evento nuevo
    Cuando escribo el nombre del evento "Fiesta de cumpleaños" con un número único
    Entonces el campo "Dirección del evento" sugiere una dirección que empieza por "fiesta-de-cumpleanos"
