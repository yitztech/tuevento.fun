# language: es
# Solo web: el pie no existe dentro de las apps
@sitio @solo-web
Característica: Las páginas del sitio público

  @solo-lectura
  Escenario: El pie lleva a una sección de la portada desde otra página
    Dado que abro la página de precios
    Cuando pulso "Preguntas frecuentes" en el pie
    Entonces veo el texto "Todo listo para dar el primer paso."
