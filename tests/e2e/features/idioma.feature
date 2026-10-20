# language: es
@i18n @solo-web @REQ-06
Característica: Selector de idioma con banderas

  Antecedentes:
    Dado que abro la página de inicio

  @solo-lectura
  Escenario: El selector de idioma muestra la bandera y el código del idioma
    Entonces el selector de idioma muestra la bandera y el código del idioma

  @solo-lectura
  Escenario: El menú de idiomas marca el idioma actual
    Cuando abro el selector de idioma
    Entonces el menú muestra todos los idiomas y marca el actual
