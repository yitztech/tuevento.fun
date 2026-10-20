# language: es
@calendario @solo-web @REQ-03
Característica: Calendario, cancelación y enlace genérico del evento

  Escenario: La invitación ofrece añadir el evento al calendario
    Dado que tengo un evento con una invitación
    Cuando abro la invitación del evento
    Entonces veo el enlace "Descargar calendario (.ics)"
    Y veo el enlace "Añadir a Google Calendar"

  Escenario: Un evento cancelado avisa en la invitación y no admite respuestas
    Dado que tengo un evento con una invitación
    Cuando cancelo el evento desde el editor
    Y abro la invitación del evento
    Entonces veo el aviso "Este evento se ha cancelado; ya no se pueden enviar respuestas."
