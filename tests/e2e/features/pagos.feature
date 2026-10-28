# language: es
@pagos @REQ-05
Característica: Pagar un evento según su número de invitados
  Un pago único por evento, sin suscripción. El plan gratuito incluye todo salvo los avisos por
  correo a los invitados. En las pruebas, el pago se hace en el doble de Stripe Checkout
  (services/payments-fake), que confirma el pago con el mismo webhook firmado que Stripe.

  # Solo web: dentro de la app, el pago se abre en el navegador del sistema
  @solo-web @smoke
  Escenario: El organizador paga su evento y vuelve con el pago confirmado
    Dado que tengo un evento creado sin escribir su dirección
    Cuando abro el panel de mi evento
    Entonces veo el aviso "Plan gratuito: todo incluido salvo los avisos por correo a tus invitados."
    Cuando pulso el enlace "Pagar este evento"
    Y pulso "Pagar $5.00"
    Entonces estoy en la página de pago de prueba
    Cuando pago en la página de pago de prueba
    Entonces veo el aviso "Pago recibido. Tus invitados ya reciben los avisos por correo."
    Y veo el aviso "Pagado: hasta 50 invitados, con avisos por correo."

  @solo-web
  Escenario: Cancelar en la página de pago vuelve sin cobrar
    Dado que tengo un evento creado sin escribir su dirección
    Cuando abro la página de pago de mi evento
    Y pulso "Pagar $5.00"
    Y cancelo en la página de pago de prueba
    Entonces veo el aviso "Plan gratuito: todo incluido salvo los avisos por correo a tus invitados."
    Y veo el botón "Pagar $5.00"

  @solo-web
  Escenario: Pasar a un tramo mayor cobra solo la diferencia
    Dado que tengo un evento creado sin escribir su dirección
    Y que ya pagué el tramo de hasta 50 invitados
    Cuando abro la página de pago de mi evento
    Entonces veo el aviso "Ya pagaste un tramo: al pasar a uno mayor solo pagas la diferencia."
    Y veo el aviso "Incluido en tu pago"
    Y veo el botón "Pagar $5.00"
    Y veo el botón "Pagar $25.00"
