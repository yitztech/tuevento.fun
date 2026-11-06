# language: es
@perfil @REQ-02
Característica: Perfil de la cuenta

  Antecedentes:
    Dado que tengo una cuenta creada y abro mi perfil

  Escenario: El perfil no muestra nombre de usuario
    Entonces no existe el campo "Nombre de usuario"
    Y el campo "Nombre" contiene "Paula"

  @solo-web @solo-lectura
  Escenario: El perfil se abre con los datos a la vista y sin poder editarlos
    Entonces el campo "Nombre" contiene "Paula"
    Y el campo "Nombre" no se puede editar
    Y el campo "Apellidos" no se puede editar
    Y el campo "Teléfono" no se puede editar
    Y veo la acción "Editar información"
    Y no veo la acción "Guardar cambios"

  @solo-web
  Escenario: Editar información habilita los campos y ofrece guardar o cancelar
    Cuando elijo editar mi información
    Entonces el campo "Nombre" se puede editar
    Y el campo "Apellidos" se puede editar
    Y el campo "Teléfono" se puede editar
    Y veo la acción "Guardar cambios"
    Y veo la acción "Cancelar"
    Y no veo la acción "Editar información"

  @solo-web
  Escenario: Tras guardar, el perfil vuelve a mostrarse sin poder editarse
    Cuando elijo editar mi información
    Y escribo "Lucía" en el campo "Nombre"
    Y guardo los cambios del perfil
    Entonces veo el aviso "Tu perfil está actualizado."
    Y el campo "Nombre" contiene "Lucía"
    Y el campo "Nombre" no se puede editar
    Y veo la acción "Editar información"

  @solo-web
  Escenario: Cancelar descarta los cambios y vuelve a solo lectura
    Cuando elijo editar mi información
    Y escribo "Lucía" en el campo "Nombre"
    Y cancelo la edición del perfil
    Entonces el campo "Nombre" contiene "Paula"
    Y el campo "Nombre" no se puede editar
    Y veo la acción "Editar información"

  @smoke
  Escenario: Cambiar el nombre y guardar
    Cuando elijo editar mi información
    Y escribo "Lucía" en el campo "Nombre"
    Y guardo los cambios del perfil
    Entonces veo el aviso "Tu perfil está actualizado."

  @validacion @FE-11
  Escenario: El perfil descarta números en el nombre
    Cuando elijo editar mi información
    Y escribo "Lu2cía" en el campo "Nombre"
    Entonces el campo "Nombre" contiene "Lucía"

  @solo-web
  Escenario: Guardar el teléfono con el prefijo del país elegido
    Cuando elijo editar mi información
    Y elijo el prefijo "+33" en el campo "País"
    Y escribo "612345678" en el campo "Teléfono"
    Y guardo los cambios del perfil
    Entonces veo el aviso "Tu perfil está actualizado."
    Cuando recargo la página
    Entonces el selector "País" muestra el prefijo "+33"

  @solo-web
  Escenario: Escribir un número con prefijo cambia el país
    Cuando elijo editar mi información
    Y escribo "+525512345678" en el campo "Teléfono"
    Entonces el selector "País" muestra el prefijo "+52"
    Y el campo "Teléfono" contiene "5512345678"

  @validacion @api @BE-26
  Escenario: La API del perfil rechaza números en el nombre
    Cuando envío a la API del perfil el nombre "Lu2cía"
    Entonces la API responde 422 con el mensaje "Usa solo letras, espacios, apóstrofo o guion."
    Y el error del campo "nombre" tiene el código "invalid_characters"
