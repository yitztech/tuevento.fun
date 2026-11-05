# language: es
# Solo web: la página pública de la invitación se cubre también dentro de las apps en
# `landing-evento.feature` (etiquetada para móvil); aquí quedan los detalles de privacidad y
# respuestas por integrante.
@landing @solo-web
Característica: La invitación pública protege las notas y responde por integrante

  Escenario: El invitado no ve las notas privadas del organizador
    Dado que un organizador tiene una invitación familiar con notas privadas
    Cuando abro mi enlace personal de invitado
    Entonces veo al integrante "Ana Prueba"
    Y no veo la nota privada "Alergia privada"
    Y no veo la nota privada "Sin nueces"

  Escenario: El invitado responde por cada integrante con estados distintos
    Dado que un organizador tiene una invitación familiar con notas privadas
    Cuando abro mi enlace personal de invitado
    Y en la invitación "Ana Prueba" respondo "¡Sí, asistiré!"
    Y en la invitación "Leo Prueba" respondo "No podré ir"
    Y pulso "Guardar mi respuesta"
    Entonces veo el aviso "¡Tu respuesta está guardada!"
