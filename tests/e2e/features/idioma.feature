# language: es
@i18n @solo-web
Característica: Selector de idioma con banderas

  Antecedentes:
    Dado que abro la página de inicio

  Escenario: Cada idioma se muestra solo con su bandera
    Entonces el selector de idioma muestra la bandera y oculta el código

  Escenario: Al pasar el ratón por el selector aparece el código del idioma
    Cuando paso el ratón por el selector de idioma
    Entonces el selector de idioma muestra el código "es"

  Escenario: Con contraste alto el código del idioma siempre se ve
    Dado que el sistema pide contraste alto
    Entonces el selector de idioma muestra el código "es"
