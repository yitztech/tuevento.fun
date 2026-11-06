# language: es
@marca @i18n @solo-lectura @solo-web
Característica: La marca nueva: logo en el idioma de la persona y favicon

  @smoke @i18n
  Esquema del escenario: La cabecera muestra el logo de su idioma
    Cuando abro la portada en "<idioma>"
    Entonces la cabecera muestra el logo en "<idioma>" y se ve completo

    Ejemplos:
      | idioma |
      | es     |
      | en     |
      | pt     |
      | de     |
      | fr     |

  @smoke
  Escenario: El HTML inicial declara el favicon y el icono de Apple de la marca nueva
    Cuando abro la portada en "es"
    Entonces el HTML inicial declara el favicon de la marca y los iconos existen

  @movil
  Escenario: El logo cabe sin desbordar en un móvil pequeño
    Cuando abro la portada en "de"
    Entonces el logo cabe en una pantalla de 320 por 640
