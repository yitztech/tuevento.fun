# language: es
@postal @solo-web @REQ-04
Característica: Texto de la postal: posición, color y sombra

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
