# language: es
@url-evento @solo-web
Característica: Dirección pública del evento

  Escenario: Publicar el evento en una dirección propia
    Dado que tengo un evento con una invitación
    Y abro la edición del evento
    Cuando escribo una dirección pública única en el campo "Dirección pública (opcional)"
    Y guardo los cambios del evento
    Entonces veo el aviso "Cambios guardados."
    Cuando abro la dirección pública de mi evento
    Entonces veo el encabezado "Fiesta de la postal"
    Y no veo a los invitados "Familia de la postal"

  Escenario: Una dirección que ya usa otro evento se rechaza
    Dado que otra cuenta ya usa una dirección pública
    Y que tengo un evento con una invitación
    Y abro la edición del evento
    Cuando escribo la dirección pública ocupada en el campo "Dirección pública (opcional)"
    Y guardo los cambios del evento
    Entonces veo el aviso "Esa dirección ya la usa otro evento. Elige otra."

  Escenario: Una dirección con mayúsculas o espacios no se admite
    Dado que tengo un evento con una invitación
    Y abro la edición del evento
    Cuando escribo "Boda Ana" en el campo "Dirección pública (opcional)"
    Y guardo los cambios del evento
    Entonces veo el aviso "Usa solo letras minúsculas sin acentos, números y guiones entre palabras, de 3 a 60 caracteres."

  Escenario: Una dirección que no existe muestra que el evento no está disponible
    Cuando abro la dirección pública "no-existe-esta-direccion"
    Entonces veo el encabezado "No encontramos este evento"
