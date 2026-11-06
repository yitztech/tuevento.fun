# language: es
# Solo en las apps (@solo-movil): la web no guarda copia local. Se ejecutan en local con
# `npm run e2e:movil`; en Android sin red es el modo avión y en iOS, el interruptor del build de
# pruebas (docs/E2E.md).
@sin-conexion @movil @solo-movil @REQ-OFF-01
Característica: Trabajar sin conexión en la app
  Sin red, la app sigue mostrando lo guardado en el teléfono, guarda los cambios en una cola y los
  envía al volver la conexión. Si otra persona cambió lo mismo, pregunta qué versión se queda.

  Antecedentes:
    Dado que tengo un evento con una invitación para "Familia Pérez" creados por la API
    Y entro en la app con esa cuenta

  Escenario: Con la app abierta y sin tocarla, no repite peticiones
    Entonces la app en reposo no repite peticiones

  Escenario: Sin red, la app arranca y muestra mis eventos guardados
    Cuando me quedo sin conexión
    Y cierro y vuelvo a abrir la app
    Entonces veo el aviso "Sin conexión. Tus cambios se guardan en el teléfono y se enviarán al volver la red."
    Y veo mi evento en la lista

  Escenario: Un evento creado sin red se envía solo al volver la conexión
    Cuando me quedo sin conexión
    Y creo el evento "Cena sin red"
    Entonces veo el aviso "Pendiente de enviar"
    Cuando vuelve la conexión
    Entonces el evento "Cena sin red" queda guardado en mi cuenta

  Escenario: Un cambio sin red sobre algo que otra persona cambió pide elegir versión
    Cuando me quedo sin conexión
    Y cambio el nombre de la invitación "Familia Pérez" por "Familia López"
    Y otra persona cambia el nombre de esa invitación por "Familia Ruiz"
    Y vuelve la conexión
    Entonces veo el aviso "1 cambio necesita tu revisión"
    Cuando abro los cambios por revisar y me quedo con mi versión
    Entonces la invitación queda guardada como "Familia López"
