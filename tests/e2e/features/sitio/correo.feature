# language: es
@correo
Característica: Confirmar el correo y darse de baja de los avisos
  Hasta que el organizador confirma su correo, la plataforma no escribe a sus invitados. Quien
  recibe avisos puede darse de baja con el enlace de cualquiera de ellos. Los flujos completos, con
  los enlaces reales de los correos, los cubre test:api (Mailpit).

  # Solo web: los enlaces de los correos se abren en el navegador, no dentro de la app
  @solo-web
  Escenario: Una cuenta nueva ve el aviso para confirmar su correo y puede pedir el enlace otra vez
    Dado que tengo una cuenta creada y abro mi perfil
    Entonces veo el aviso "Hasta entonces, tus invitados no recibirán avisos por correo."
    Cuando pulso "Enviar el enlace otra vez"
    Entonces veo el aviso "Te enviamos un enlace nuevo"

  @solo-web @validacion
  Escenario: Un enlace para confirmar el correo que ya caducó lo explica
    Cuando abro un enlace para confirmar el correo que ya caducó
    Entonces veo el aviso "Este enlace para confirmar el correo no es válido o ya caducó."

  @solo-web @validacion
  Escenario: Un enlace para darse de baja que no es válido lo explica
    Cuando abro un enlace para dejar de recibir avisos que no es válido
    Y pulso "Darme de baja"
    Entonces veo el aviso "Este enlace para darse de baja no es válido."
