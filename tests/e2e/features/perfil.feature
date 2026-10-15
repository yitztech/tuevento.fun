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

  @validacion @api
  Escenario: La API del perfil rechaza números en el nombre
    Cuando envío a la API del perfil el nombre "Lu2cía"
    Entonces la API responde 400 con el mensaje "Usa solo letras, espacios, apóstrofo o guion."
