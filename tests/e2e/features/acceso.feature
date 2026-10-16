# language: es
@acceso @validacion
Característica: Inicio de sesión con las mismas reglas que el registro

  Antecedentes:
    Dado que abro la página de acceso

  @limites
  Escenario: La contraseña admite como máximo 128 caracteres
    Entonces el campo "Contraseña" admite como máximo 128 caracteres

  Escenario: Una contraseña de menos de 10 caracteres se rechaza al entrar
    Cuando escribo "ana@example.com" en el campo "Correo electrónico"
    Y escribo "corta" en el campo "Contraseña"
    Y envío el formulario de acceso
    Entonces veo el aviso "Usa al menos 10 caracteres."

  Escenario: Un correo no válido se rechaza al entrar
    Cuando escribo "no-es-correo" en el campo "Correo electrónico"
    Y escribo "una-clave-larga-1" en el campo "Contraseña"
    Y envío el formulario de acceso
    Entonces veo el aviso "Escribe un correo válido."
