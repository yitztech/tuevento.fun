# language: es
@i18n @solo-web @REQ-06
Característica: Selector de idioma con banderas

  Antecedentes:
    Dado que abro la página de inicio

  @solo-lectura
  Escenario: El selector de idioma muestra solo el código; las banderas van en el menú
    Entonces el selector de idioma muestra el código del idioma sin bandera
    Cuando abro el selector de idioma
    Entonces cada idioma del menú lleva su bandera

  @solo-lectura
  Escenario: El selector de idioma se integra con la cabecera, sin borde ni fondo
    Entonces el selector de idioma no tiene borde ni fondo

  @solo-lectura
  Escenario: El idioma actual se resalta con su fondo y el menú cabe en la pantalla
    Cuando abro el selector de idioma
    Entonces el idioma actual lleva fondo redondeado y check
    Y el menú de idiomas cabe en la pantalla

  @solo-lectura
  Escenario: Un clic fuera cierra el menú de idiomas
    Cuando abro el selector de idioma
    Y hago clic fuera del menú de idiomas
    Entonces el menú de idiomas está cerrado

  @solo-lectura
  Escenario: Escape cierra el menú de idiomas y devuelve el foco al botón
    Cuando abro el selector de idioma
    Y pulso Escape
    Entonces el menú de idiomas está cerrado
    Y el foco está en el botón del selector de idioma

  @solo-lectura
  Escenario: El menú de idiomas marca el idioma actual
    Cuando abro el selector de idioma
    Entonces el menú muestra todos los idiomas y marca el actual

  @solo-lectura @i18n
  Esquema del escenario: El menú de idiomas empieza directamente por la lista, sin título
    Cuando abro la portada en "<idioma>"
    Y abro el selector de idioma
    Entonces el menú solo contiene los idiomas

    Ejemplos:
      | idioma |
      | es     |
      | en     |
      | pt     |
      | de     |
      | fr     |
