# language: es
@landing @REQ-08
Característica: Landing de cada evento
  Cada evento tiene su página en <sitio>/<código de la cuenta>/<dirección>, con el prefijo del idioma.
  El organizador la ve con el acceso a su panel; los invitados entran con su enlace personal y solo
  ven la landing, con su invitación para responder.

  @movil @smoke
  Escenario: El invitado entra con su enlace personal, llega a la landing y responde
    Dado que un organizador tiene un evento con una invitación para "Ana García"
    Cuando abro mi enlace personal de invitado
    Entonces llego a la landing del evento
    Cuando respondo que asistiré
    Entonces veo el aviso "¡Tu respuesta está guardada!"

  @solo-web
  Escenario: El invitado no ve el acceso al panel del organizador
    Dado que un organizador tiene un evento con una invitación para "Ana García"
    Cuando abro mi enlace personal de invitado
    Entonces llego a la landing del evento
    Y no veo el enlace "Ir al panel del evento"

  @solo-web
  Escenario: Sin enlace personal ni sesión, la landing es solo para invitados
    Dado que un organizador tiene un evento con una invitación para "Ana García"
    Cuando abro la landing del evento sin enlace personal
    Entonces veo el encabezado "Esta página es solo para invitados"
    Y no veo el título del evento

  @solo-web
  Escenario: Un evento creado sin escribir la dirección tiene su landing, y desde ella se vuelve al panel
    Dado que tengo un evento creado sin escribir su dirección
    Cuando abro la página del evento desde su panel
    Entonces estoy en la landing de mi evento, con una dirección sacada del título
    Y veo el encabezado con el título del evento
    Cuando pulso el enlace "Ir al panel del evento"
    Entonces vuelvo al panel del evento

  @solo-web
  Escenario: El organizador que abre el enlace de un invitado ve lo mismo que él, con su panel a mano
    Dado que tengo un evento con una invitación
    Cuando abro el enlace personal de mi invitado
    Entonces veo el encabezado "Sin ti, no es lo mismo."
    Y veo el enlace "Ir al panel del evento"

  @i18n @solo-web
  Esquema del escenario: El enlace personal lleva a la landing en el idioma de su dominio
    Dado que un organizador tiene un evento con una invitación para "Ana García"
    Cuando abro mi enlace personal de invitado en "<idioma>"
    Entonces llego a la landing del evento en "<idioma>"
    Y veo el encabezado "<encabezado>"

    Ejemplos:
      | idioma | encabezado                           |
      | es     | Sin ti, no es lo mismo.              |
      | en     | It wouldn't be the same without you. |
      | pt     | Sem você, não seria a mesma coisa.   |
      | de     | Ohne dich wäre es nicht dasselbe.    |
      | fr     | Sans toi, ce ne serait pas pareil.   |
