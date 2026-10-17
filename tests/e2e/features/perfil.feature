# language: es
@perfil
Característica: Perfil de la cuenta

  Antecedentes:
    Dado que tengo una cuenta creada y abro mi perfil

  Escenario: El perfil no muestra nombre de usuario
    Entonces no existe el campo "Nombre de usuario"
    Y el campo "Nombre" contiene "Paula"

  @smoke
  Escenario: Cambiar el nombre y guardar
    Cuando escribo "Lucía" en el campo "Nombre"
    Y guardo los cambios del perfil
    Entonces veo el aviso "Tu perfil está actualizado."

  @validacion
  Escenario: El perfil descarta números en el nombre
    Cuando escribo "Lu2cía" en el campo "Nombre"
    Entonces el campo "Nombre" contiene "Lucía"

  @solo-web
  Escenario: Guardar el teléfono con el prefijo del país elegido
    Cuando elijo el prefijo "+33" en el campo "País"
    Y escribo "612345678" en el campo "Teléfono"
    Y guardo los cambios del perfil
    Entonces veo el aviso "Tu perfil está actualizado."
    Cuando recargo la página
    Entonces el selector "País" muestra el prefijo "+33"

  @solo-web
  Escenario: Escribir un número con prefijo cambia el país
    Cuando escribo "+525512345678" en el campo "Teléfono"
    Entonces el selector "País" muestra el prefijo "+52"
    Y el campo "Teléfono" contiene "5512345678"

  @validacion @api
  Escenario: La API del perfil rechaza números en el nombre
    Cuando envío a la API del perfil el nombre "Lu2cía"
    Entonces la API responde 400 con el mensaje "Usa solo letras, espacios, apóstrofo o guion."
