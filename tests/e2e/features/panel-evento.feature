# language: es
@evento @solo-web
Característica: El modo pantalla del evento
  La vista para monitores grandes (Smart TV) muestra el evento con su métrica y permite volver.

  Escenario: El modo pantalla muestra el evento y permite volver
    Dado que tengo un evento con una invitación
    Cuando abro el modo pantalla de mi evento
    Entonces veo el encabezado "Fiesta de la postal"
    Y veo el enlace "Volver al evento"
    Y veo el botón "Pantalla completa"
