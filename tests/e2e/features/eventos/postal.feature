# language: es
@postal @solo-web @REQ-04
Característica: Postal editable por evento
  El editor de la postal y el texto sobre ella: posición, color y sombra.

  Escenario: Diseñar la postal y verla en la invitación
    Dado que tengo un evento con una invitación
    Y abro el editor de la postal del evento
    Cuando elijo el fondo de color "#1d4e6b"
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

  Escenario: Mover un texto arrastrándolo dentro de la postal
    Dado que tengo un evento con una invitación
    Y abro el editor de la postal del evento
    Y añado el texto "Mover aquí"
    Cuando arrastro el texto "Mover aquí" un 10 % a la derecha y un 20 % hacia abajo
    Y guardo la postal
    Y abro la invitación del evento
    Entonces la invitación muestra el texto "Mover aquí" a un 20 % de la izquierda y un 60 % desde arriba

  Escenario: Elegir un color libre y una sombra para el texto
    Dado que tengo un evento con una invitación
    Y abro el editor de la postal del evento
    Y añado el texto "Con sombra"
    Cuando elijo el color "#123456" para el texto
    Y activo la sombra del texto
    Y guardo la postal
    Y abro la invitación del evento
    Entonces la invitación muestra el texto "Con sombra" con sombra

  Escenario: Elegir un color de fondo de la paleta ampliada
    Dado que tengo un evento con una invitación
    Y abro el editor de la postal del evento
    Cuando elijo el color de fondo "#6b6b6b"
    Y guardo la postal
    Y abro la invitación del evento
    Entonces la invitación muestra el fondo de color "#6b6b6b"

  Escenario: Diseñar una postal propia desde los diseños la añade a Mis postales
    Dado que abro los diseños con una cuenta nueva
    Cuando pulso el botón "Diseñar mi invitación"
    Y elijo el fondo de color "#1d4e6b"
    Y añado el texto "Mi postal"
    Y guardo la postal
    Entonces veo el aviso "Postal guardada en Mis postales."
    Cuando vuelvo a los diseños
    Entonces veo 1 postal en Mis postales

  Escenario: Una postal propia sin guardar no aparece en Mis postales
    Dado que abro los diseños con una cuenta nueva
    Cuando pulso el botón "Diseñar mi invitación"
    Y vuelvo a los diseños
    Entonces no veo Mis postales

  Escenario: Borrar una postal propia la quita de Mis postales
    Dado que abro los diseños con una cuenta nueva
    Cuando pulso el botón "Diseñar mi invitación"
    Y elijo el fondo de color "#1d4e6b"
    Y guardo la postal
    Y vuelvo a los diseños
    Y borro la primera postal de Mis postales
    Entonces veo el aviso "Postal borrada."
    Y no veo Mis postales
