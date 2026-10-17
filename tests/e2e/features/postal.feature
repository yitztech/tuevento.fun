# language: es
@postal @solo-web
Característica: Postal editable por evento

  Escenario: Diseñar la postal y verla en la invitación
    Dado que tengo un evento con una invitación
    Y abro el editor de la postal del evento
    Cuando elijo el fondo de color "Azul"
    Y añado el texto "Feliz cumple"
    Y guardo la postal
    Entonces veo el aviso "Postal guardada."
    Cuando abro la invitación del evento
    Entonces la invitación muestra la postal con el texto "Feliz cumple"

  Esquema del escenario: El editor de la postal cabe en móviles y tabletas
    Dado que tengo un evento con una invitación
    Cuando abro el editor de la postal a <ancho> por <alto>
    Entonces la postal cabe sin desbordamiento horizontal

    Ejemplos:
      | ancho | alto |
      | 320   | 568  |
      | 390   | 844  |
      | 768   | 1024 |
      | 1180  | 820  |
