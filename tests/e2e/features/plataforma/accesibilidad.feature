# language: es
@plataforma @accesibilidad @solo-lectura @solo-web
Característica: Accesibilidad de las páginas públicas
  Las páginas públicas no tienen infracciones graves ni críticas de axe (WCAG 2.2 AA).

  @FE-05
  Esquema del escenario: Las páginas públicas pasan axe sin infracciones graves
    Cuando abro la página "<ruta>" en "<idioma>"
    Entonces axe no encuentra infracciones graves ni críticas

    Ejemplos:
      | idioma | ruta         |
      | es     | /            |
      | es     | /registro    |
      | es     | /acceso      |
      | es     | /precios     |
      | es     | /privacidad  |
      | en     | /            |
      | en     | /registro    |
      | pt     | /            |
      | de     | /            |
      | fr     | /            |
