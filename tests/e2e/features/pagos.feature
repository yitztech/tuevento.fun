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

  @solo-web @smoke
  Escenario: Un cupón baja el precio antes de pagar
    Dado que tengo un evento creado sin escribir su dirección
    Y que existe un cupón del 50 %
    Cuando abro la página de pago de mi evento
    Y aplico el cupón
    Entonces veo que el cupón está aplicado
    Y veo el botón "Pagar $2.50"
    Cuando pulso "Pagar $2.50"
    Y pago en la página de pago de prueba
    Entonces veo el aviso "Pago recibido. Tus invitados ya reciben los avisos por correo."

  @solo-web
  Escenario: Un cupón del 100 % activa el evento sin pasar por la página de pago
    Dado que tengo un evento creado sin escribir su dirección
    Y que existe un cupón del 100 %
    Cuando abro la página de pago de mi evento
    Y aplico el cupón
    Y pulso el primer botón "Activar gratis"
    Entonces veo el aviso "Pago recibido. Tus invitados ya reciben los avisos por correo."
    Y veo el aviso "Pagado: hasta 50 invitados, con avisos por correo."

  @solo-web
  Escenario: Si falla la recarga tras un cupón del 100 %, el pago se ve confirmado
    Dado que tengo un evento creado sin escribir su dirección
    Y que existe un cupón del 100 %
    Cuando abro la página de pago de mi evento
    Y aplico el cupón
    Y falla la siguiente carga de mis eventos
    Y pulso el primer botón "Activar gratis"
    Entonces veo el aviso "Pago recibido. Tus invitados ya reciben los avisos por correo."

  @solo-web
  Escenario: Un cupón que deja de valer antes de pagar devuelve el precio completo
    Dado que tengo un evento creado sin escribir su dirección
    Y que existe un cupón del 50 %
    Cuando abro la página de pago de mi evento
    Y aplico el cupón
    Y el administrador desactiva el cupón
    Y pulso "Pagar $2.50"
    Entonces veo el aviso "Ese cupón no es válido o ya no está disponible."
    Y veo el botón "Pagar $5.00"

  @solo-web
  Escenario: Quitar el cupón devuelve el precio completo
    Dado que tengo un evento creado sin escribir su dirección
    Y que existe un cupón del 50 %
    Cuando abro la página de pago de mi evento
    Y aplico el cupón
    Y pulso "Quitar cupón"
    Entonces veo el botón "Pagar $5.00"

  @solo-web @validacion
  Escenario: Un cupón que no existe muestra el error y no cambia el precio
    Dado que tengo un evento creado sin escribir su dirección
    Cuando abro la página de pago de mi evento
    Y escribo el cupón "NO-EXISTE"
    Y pulso "Aplicar"
    Entonces veo el aviso "Ese cupón no es válido o ya no está disponible."
    Y veo el botón "Pagar $5.00"

  @solo-web @validacion
  Escenario: El campo del cupón descarta lo que no es un código y dice por qué
    Dado que tengo un evento creado sin escribir su dirección
    Cuando abro la página de pago de mi evento
    Y escribo el cupón "ab c-1!"
    Entonces el cupón escrito es "ABC-1"
    Y veo el aviso "Solo letras sin tilde, números y guiones."

  @solo-web @i18n
  Esquema del escenario: El campo del cupón está en el idioma de la página
    Cuando abro la página de pago de un evento mío en "<idioma>"
    Entonces veo el campo de cupón "<etiqueta>"

    Ejemplos:
      | idioma | etiqueta                 |
      | es     | ¿Tienes un cupón?        |
      | en     | Have a coupon?           |
      | pt     | Tem um cupom?            |
      | de     | Hast du einen Gutschein? |
      | fr     | Tu as un code promo ?    |
