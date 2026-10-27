# language: es
@url-evento @solo-web @REQ-03
Característica: Dirección del evento
  La dirección es la última parte de la URL de la landing (<sitio>/<código de la cuenta>/<dirección>):
  única dentro de cada cuenta, no en todo el servicio.

  Escenario: Cambiar la dirección del evento
    Dado que tengo un evento con una invitación
    Y abro la edición del evento
    Cuando escribo una dirección pública única en el campo "Dirección del evento"
    Y guardo los cambios del evento
    Entonces veo el aviso "Cambios guardados."
    Cuando abro la dirección pública de mi evento
    Entonces veo el encabezado "Fiesta de la postal"
    Y no veo a los invitados "Familia de la postal"

  Escenario: Una dirección que ya usa otro de mis eventos se rechaza
    Dado que tengo un evento con una invitación
    Y que otro de mis eventos ya usa una dirección
    Y abro la edición del evento
    Cuando escribo la dirección pública ocupada en el campo "Dirección del evento"
    Y guardo los cambios del evento
    Entonces veo el aviso "Ya tienes otro evento con esa dirección. Elige otra."

  Escenario: Otra cuenta puede usar la misma dirección
    Dado que otra cuenta ya usa una dirección pública
    Y que tengo un evento con una invitación
    Y abro la edición del evento
    Cuando escribo la dirección pública ocupada en el campo "Dirección del evento"
    Y guardo los cambios del evento
    Entonces veo el aviso "Cambios guardados."

  Escenario: Una dirección con mayúsculas o espacios no se admite
    Dado que tengo un evento con una invitación
    Y abro la edición del evento
    Cuando escribo "Boda Ana" en el campo "Dirección del evento"
    Y guardo los cambios del evento
    Entonces veo el aviso "Usa solo letras minúsculas sin acentos, números y guiones entre palabras, de 3 a 60 caracteres."

  @solo-lectura
  Escenario: Una dirección antigua (/e/…) que no existe muestra que el evento no está disponible
    Cuando abro la dirección pública "no-existe-esta-direccion"
    Entonces veo el encabezado "No encontramos este evento"
