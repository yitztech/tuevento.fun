# language: es
# @solo-web: los pasos abren la sesión del organizador con la API del navegador; en las apps el
# panel es el mismo componente, y la búsqueda dentro de la app la cubre busqueda-proveedores.feature.
@eventos @proveedores @solo-web @REQ-PROV-07
Característica: Buscar proveedores desde el evento
  Al crear o editar un evento, y en su detalle, una invitación opcional abre la búsqueda de
  proveedores cerca del lugar sin salir de la página ni perder lo escrito.

  @smoke
  Escenario: El botón abre la búsqueda en la ubicación del evento y el formulario conserva lo escrito
    Dado que tengo un evento en el mapa y un negocio publicado a 3 km del lugar
    Cuando abro la edición del evento
    Y escribo "Cena con mariachi" en el campo "Nombre del evento"
    Y pulso el botón "Buscar proveedores"
    Entonces el panel busca cerca de la dirección del evento
    Y veo la tarjeta del negocio en el panel
    Cuando abro la tarjeta del negocio en el panel
    Entonces veo la página del negocio dentro del panel
    Cuando pulso el botón "Volver a los resultados"
    Entonces veo la tarjeta del negocio en el panel
    Cuando pulso la tecla "Escape"
    Entonces el panel está cerrado y el foco vuelve al botón "Buscar proveedores"
    Y el campo "Nombre del evento" contiene "Cena con mariachi"

  Escenario: Sin punto en el mapa, la búsqueda parte de la dirección escrita del evento
    Dado que tengo un evento en "Hacienda San Gabriel" sin punto en el mapa
    Cuando abro el detalle del evento
    Y pulso el botón "Buscar proveedores"
    Entonces el panel busca cerca de "Hacienda San Gabriel"

  Escenario: «Ahora no» oculta la invitación de ese evento también al volver
    Dado que tengo un evento en "Hacienda San Gabriel" sin punto en el mapa
    Cuando abro el detalle del evento
    Y pulso el botón "Ahora no"
    Entonces no veo el botón "Buscar proveedores"
    Cuando recargo la página
    Entonces veo el título del evento
    Y no veo el botón "Buscar proveedores"
