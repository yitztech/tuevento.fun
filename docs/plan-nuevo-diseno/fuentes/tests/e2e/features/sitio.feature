# language: es
# Solo web: la cabecera, el pie y la portada no existen dentro de las apps
@sitio @solo-web
Característica: El sitio público

  @solo-lectura
  Escenario: Filtrar los diseños por estilo deja elegido el primero de ese estilo
    Dado que abro la portada
    Cuando filtro los diseños por "Infantil"
    Entonces veo 2 diseños de muestra
    Y el enlace "Crear con este diseño" lleva a "/registro?tema=kids"

  @solo-lectura
  Escenario: Una categoría de proveedores de la portada abre la búsqueda filtrada
    Dado que abro la portada
    Cuando pulso el enlace "Banquetes y catering" de la portada
    Entonces la dirección termina en "?cat=catering"

  @solo-lectura
  Escenario: El menú del teléfono se cierra con Escape
    Dado que abro la portada en un teléfono
    Cuando abro el menú del sitio
    Y pulso la tecla Escape
    Entonces el menú del sitio está cerrado

  @i18n @solo-lectura
  Esquema del escenario: La portada se lee en cada idioma
    Cuando abro la portada en "<idioma>"
    Entonces veo el título "<titulo>"

    Ejemplos:
      | idioma | titulo                              |
      | es     | Lo bonito es estar juntos.          |
      | en     | The joy is being together.          |
      | pt     | O bom é estar juntos.               |
      | de     | Das Schönste ist das Zusammensein.  |
      | fr     | Le bonheur, c’est d’être ensemble.  |
