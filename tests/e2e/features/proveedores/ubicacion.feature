# language: es
@ubicacion @REQ-PROV-01
Característica: Ubicación del evento en el mapa
  El organizador fija el punto exacto del lugar: buscándolo en el mapa o pegando un enlace de
  Google Maps, Apple Maps o Waze. Los invitados lo abren en su app de mapas.

  @solo-web @smoke
  Escenario: El organizador busca el lugar en el mapa, elige el resultado y el punto queda guardado
    Dado que tengo un evento creado sin escribir su dirección
    Cuando abro la edición del evento
    Y escribo "Jardín Borda" en el campo "¿Dónde nos vemos?"
    Y pulso el botón "Buscar en el mapa"
    Y elijo el primer lugar de la lista
    Entonces veo el texto "El punto exacto está marcado en el mapa."
    Cuando guardo los cambios del evento
    Entonces mi evento guarda el punto del mapa

  @solo-web
  Escenario: Pegar un enlace de Google Maps fija el punto exacto
    Dado que tengo un evento creado sin escribir su dirección
    Cuando abro la edición del evento
    Y pego el enlace de mapas "https://www.google.com/maps/place/X/@18.9,-99.2,17z/data=!3d18.921831!4d-99.234567"
    Entonces veo el texto "El punto exacto está marcado en el mapa."
    Cuando guardo los cambios del evento
    Entonces mi evento queda en el punto 18.921831, -99.234567

  @solo-web @validacion
  Escenario: Un enlace de mapas sin coordenadas explica cómo conseguir el bueno
    Dado que tengo un evento creado sin escribir su dirección
    Cuando abro la edición del evento
    Y pego el enlace de mapas "https://www.google.com/maps/place/Jard%C3%ADn+Borda"
    Entonces veo la alerta "Ese enlace no trae la ubicación. En la app de mapas, abre el lugar, pulsa «Compartir» y copia ese enlace."

  @solo-web @validacion
  Escenario: Un enlace que no es de una app de mapas se rechaza
    Dado que tengo un evento creado sin escribir su dirección
    Cuando abro la edición del evento
    Y pego el enlace de mapas "https://example.com/?q=18.9,-99.2"
    Entonces veo la alerta "Pega un enlace https de Google Maps, Apple Maps o Waze."

  @solo-web
  Escenario: Si el lugar no aparece en el mapa, se ofrece otra salida
    Dado que tengo un evento creado sin escribir su dirección
    Cuando abro la edición del evento
    Y escribo "sin resultados en ningún sitio" en el campo "¿Dónde nos vemos?"
    Y pulso el botón "Buscar en el mapa"
    Entonces veo el texto "No encontramos ese lugar. Prueba con otra dirección o pega un enlace de mapas."

  @solo-web
  Escenario: Con la búsqueda del mapa caída, el editor lo dice y sigue funcionando
    Dado que tengo un evento creado sin escribir su dirección
    Cuando abro la edición del evento
    Y escribo "falla del mapa" en el campo "¿Dónde nos vemos?"
    Y pulso el botón "Buscar en el mapa"
    Entonces veo la alerta "La búsqueda en el mapa no está disponible ahora. Inténtalo en unos minutos o pega un enlace de mapas."

  @solo-web
  Escenario: El invitado abre el lugar exacto en Waze y en Google Maps
    Dado que un organizador tiene un evento en el punto 18.921831, -99.234567 con una invitación para "Ana García"
    Cuando abro mi enlace personal de invitado
    Entonces llego a la landing del evento
    Y el enlace "Waze" lleva a "https://waze.com/ul?ll=18.921831,-99.234567&navigate=yes"
    Y el enlace "Cómo llegar" lleva a "https://www.google.com/maps/dir/?api=1&destination=18.921831,-99.234567"

  @solo-web
  Escenario: Sin punto exacto, los enlaces de mapas buscan el nombre del lugar
    Dado que un organizador tiene un evento con una invitación para "Ana García"
    Cuando abro mi enlace personal de invitado
    Entonces llego a la landing del evento
    Y el enlace "Waze" lleva a "https://waze.com/ul?q=Jard%C3%ADn%20de%20pruebas&navigate=yes"
