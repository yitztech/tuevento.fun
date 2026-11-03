# language: es
# Solo web: la frase depende del ancho de escritorio
@sitio @solo-web
Característica: La página de acceso

  @solo-lectura
  Escenario: La página de acceso muestra su frase en escritorio
    Dado que abro la página de acceso en un escritorio
    Entonces veo el texto "Los mejores momentos comienzan aquí."
