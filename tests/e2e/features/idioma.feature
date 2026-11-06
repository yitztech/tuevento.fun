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
  Escenario: Las opciones del menú dejan a la derecha el doble de margen que a la izquierda
    Cuando abro el selector de idioma
    Entonces cada opción del menú tiene a la derecha el doble de margen que a la izquierda

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
