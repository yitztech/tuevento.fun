# language: es
@acceso @validacion @REQ-01
Característica: Inicio de sesión con las mismas reglas que el registro

  Antecedentes:
    Dado que abro la página de acceso

  @smoke
  Escenario: Con una cuenta creada, entro con mi correo y mi contraseña
    Dado que tengo una cuenta creada por la API sin sesión en el navegador
    Cuando escribo mi correo y mi contraseña en el formulario de acceso
    Y envío el formulario de acceso
    Entonces entro en mi espacio

  @limites @solo-lectura
  Escenario: La contraseña admite como máximo 128 caracteres
    Entonces el campo "Contraseña" admite como máximo 128 caracteres

  @solo-lectura
  Escenario: Una contraseña de menos de 10 caracteres se rechaza al entrar
    Cuando escribo "ana@example.com" en el campo "Correo electrónico"
    Y escribo "corta" en el campo "Contraseña"
    Y envío el formulario de acceso
    Entonces veo el aviso "Usa al menos 10 caracteres."

  @solo-lectura
  Escenario: Un correo no válido se rechaza al entrar
    Cuando escribo "no-es-correo" en el campo "Correo electrónico"
    Y escribo "una-clave-larga-1" en el campo "Contraseña"
    Y envío el formulario de acceso
    Entonces veo el aviso "Escribe un correo válido."
