# language: es
@i18n @solo-web
Característica: Selector de idioma con banderas

  Antecedentes:
    Dado que abro la página de inicio

  Escenario: El selector de idioma muestra la bandera y el código del idioma
    Entonces el selector de idioma muestra la bandera y el código del idioma

  Escenario: El menú de idiomas marca el idioma actual
    Cuando abro el selector de idioma
    Entonces el menú muestra todos los idiomas y marca el actual
