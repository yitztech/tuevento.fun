# language: es
@plataforma @i18n @solo-lectura @solo-web
Característica: Un idioma por dominio, con sus cabeceras y su HTML inicial
  El dominio (o el prefijo /pt, /de, /fr) decide el idioma desde el primer HTML, sin JavaScript.

  @smoke @I18N-07
  Esquema del escenario: La portada sirve el idioma, el título y la descripción de su dominio
    Cuando abro la portada en "<idioma>"
    Entonces el HTML inicial está en "<idioma>"
    Y el título del HTML inicial es "<título>"
    Y la descripción del HTML inicial empieza por "<descripción>"
    Y el enlace canonical apunta a la portada en "<idioma>"

    Ejemplos:
      | idioma | título                                          | descripción                    |
      | es     | TuEventoFun · Invita, reúne y celebra           | Crea invitaciones con tu estilo |
      | en     | TuEventoFun · Invite, gather and celebrate      | Create invitations in your style |
      | pt     | TuEventoFun · Convide, reúna e celebre          | Crie convites com o seu estilo  |
      | de     | TuEventoFun · Einladen, zusammenkommen, feiern  | Erstelle Einladungen            |
      | fr     | TuEventoFun · Invite, rassemble et fais la fête | Crée des invitations            |

  @smoke @SEG-04
  Esquema del escenario: Las páginas llevan las cabeceras de seguridad
    Cuando abro la portada en "<idioma>"
    Entonces la página lleva las cabeceras de seguridad

    Ejemplos:
      | idioma |
      | es     |
      | en     |
      | pt     |

  Escenario: Un idioma alojado pedido en otro dominio redirige con 301 a su dominio
    Cuando abro "/pt/" en el dominio en "es"
    Entonces la respuesta fue una redirección 301
    Y estoy en la portada en "pt"
