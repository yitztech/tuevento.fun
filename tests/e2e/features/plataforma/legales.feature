# language: es
@plataforma @legal @solo-lectura @solo-web
Característica: Páginas legales en cada idioma

  Esquema del escenario: La política de privacidad y las condiciones se publican en cada idioma
    Cuando abro la página "<privacidad>" en "<idioma>"
    Entonces la página responde 200 con un título principal
    Y el HTML inicial está en "<idioma>"
    Cuando abro la página "<condiciones>" en "<idioma>"
    Entonces la página responde 200 con un título principal

    Ejemplos:
      | idioma | privacidad       | condiciones          |
      | es     | /privacidad      | /condiciones         |
      | en     | /privacy         | /terms               |
      | pt     | /privacidade     | /termos              |
      | de     | /datenschutz     | /nutzungsbedingungen |
      | fr     | /confidentialite | /conditions          |
