# language: es
@generica @solo-web
Característica: Invitación genérica

  Escenario: Un invitado se registra con sus propios datos desde un enlace genérico
    Dado que tengo un evento con una invitación
    Y que tengo un enlace genérico del evento
    Cuando abro el enlace genérico
    Y relleno el campo "Tu nombre" con "Familia Ruiz"
    Y relleno el campo "Nombre" con "Paula Ruiz"
    Y envío mi respuesta de registro
    Entonces veo a "Paula Ruiz" en su propia invitación

  Escenario: Con el evento cancelado, el enlace genérico ya no admite registros
    Dado que tengo un evento con una invitación
    Y que tengo un enlace genérico del evento
    Y que cancelo el evento por la API
    Cuando abro el enlace genérico
    Entonces veo el aviso "Este evento se ha cancelado; ya no se pueden enviar respuestas."
