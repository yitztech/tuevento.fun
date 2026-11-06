# language: es
@registro @movil @REQ-01
Característica: Crear una cuenta
  Para empezar a organizar eventos
  Como persona nueva
  Quiero crear mi cuenta con el correo electrónico como identificador

  Antecedentes:
    Dado que abro la página de registro

  @smoke
  Escenario: Crear una cuenta con datos válidos
    Cuando relleno el registro con datos válidos
    Y envío el formulario de registro
    Entonces me pide confirmar mi correo

  Escenario: Sin confirmar el correo no se entra a la app
    Cuando relleno el registro con datos válidos
    Y envío el formulario de registro
    Y abro la página "/eventos"
    Entonces me pide confirmar mi correo

  Esquema del escenario: Tras confirmar el correo elijo el tipo de cuenta y veo mi bienvenida
    Cuando relleno el registro con datos válidos
    Y envío el formulario de registro
    Y confirmo mi correo con el enlace que recibí
    Entonces me pregunta cómo voy a usar la plataforma
    Cuando elijo la opción "<opcion>"
    Y continúo con el registro
    Entonces veo la bienvenida "<bienvenida>"

    Ejemplos:
      | opcion                                  | bienvenida                      |
      | Organizar mi evento                     | Todo listo para tu evento       |
      | Soy proveedor de servicios para eventos | Haz que te encuentren           |
      | Soy agencia organizadora de eventos     | Tu agencia, lista para trabajar |

  @solo-lectura
  Escenario: El formulario de registro no pregunta el tipo de cuenta
    Entonces no existe el campo "Organizar mi evento"

  @solo-lectura
  Escenario: El registro no pide nombre de usuario
    Entonces no existe el campo "Nombre de usuario"
    Y veo el campo "Correo electrónico"

  @solo-lectura
  Escenario: Las etiquetas indican que pueden ser varios nombres y apellidos
    Entonces veo el campo "Nombre(s)"
    Y veo el campo "Apellido(s)"

  @i18n @solo-web @solo-lectura
  Escenario: Las etiquetas se muestran en inglés en el dominio inglés
    Dado que abro la página de registro en inglés
    Entonces veo el campo "First name(s)"
    Y veo el campo "Last name(s)"
    Y no existe el campo "Username"

  @validacion @solo-lectura @FE-11
  Esquema del escenario: Nombre y apellidos descartan lo que no son letras
    Cuando escribo "<escrito>" en el campo "<campo>"
    Entonces el campo "<campo>" contiene "<queda>"

    Ejemplos:
      | campo       | escrito         | queda       |
      | Nombre(s)   | Ana123 Ma_ría   | Ana María   |
      | Apellido(s) | O'Connor9-Núñez | O'Connor-Núñez |
      | Nombre(s)   | 12345           |             |

  @validacion @solo-lectura @FE-11
  Esquema del escenario: El teléfono descarta las letras
    Cuando escribo "<escrito>" en el campo "Teléfono"
    Entonces el campo "Teléfono" contiene "<queda>"

    Ejemplos:
      | escrito              | queda            |
      | +52 abc 555-12(3)x4  | 555-12(3)4       |
      | llamame              |                  |

  @validacion @solo-lectura @FE-11
  Esquema del escenario: El código de país del teléfono solo admite dígitos y hasta 3
    Cuando escribo "<escrito>" en el campo "Código de país"
    Entonces el campo "Código de país" contiene "<queda>"

    Ejemplos:
      | escrito | queda |
      | 5       | 5     |
      | 52      | 52    |
      | 353     | 353   |
      | 3531    | 353   |
      | +5a2    | 52    |
      | abc     |       |

  @limites @solo-lectura
  Esquema del escenario: Entre el código de país y el número no hay más de 15 dígitos
    Cuando escribo "<código>" en el campo "Código de país"
    Y escribo "<número>" en el campo "Teléfono"
    Entonces el campo "Teléfono" contiene "<queda>"

    Ejemplos:
      | código | número            | queda          |
      | 1      | 123456789012345   | 12345678901234 |
      | 52     | 123456789012345   | 1234567890123  |
      | 353    | 123456789012345   | 123456789012   |

  @validacion @solo-lectura
  Escenario: Un teléfono pegado con su prefijo separa el código de país
    Cuando escribo "+52 55 1234 5678" en el campo "Teléfono"
    Entonces el campo "Código de país" contiene "52"
    Y el campo "Teléfono" contiene "55 1234 5678"

  @validacion @solo-lectura
  Escenario: El código de país tiene un máximo de 3 dígitos
    Entonces el campo "Código de país" admite como máximo 3 caracteres

  @validacion @solo-lectura
  Escenario: Las contraseñas deben coincidir
    Cuando relleno el registro con datos válidos
    Y escribo "otra-clave-larga-9" en el campo "Repetir contraseña"
    Y envío el formulario de registro
    Entonces veo el aviso "Las contraseñas no coinciden."

  @validacion @solo-lectura
  Escenario: El registro ya no pide foto o logotipo
    Entonces no existe el campo "Cargar avatar de registro"

  @limites @solo-lectura
  Esquema del escenario: Cada campo tiene su longitud máxima
    Entonces el campo "<campo>" admite como máximo <maximo> caracteres

    Ejemplos:
      | campo              | maximo |
      | Nombre(s)          | 50     |
      | Apellido(s)        | 50     |
      | Teléfono           | 20     |
      | Correo electrónico | 254    |
      | Contraseña         | 128    |

  # En iOS, Appium asigna el valor por programa y se salta el maxlength que sí respeta el
  # teclado; la longitud queda cubierta por el escenario de los atributos maxlength.
  @limites @sin-ios @solo-lectura
  Escenario: Un nombre muy largo se corta en el máximo permitido
    Cuando pego un texto de 60 letras en el campo "Nombre(s)"
    Entonces el campo "Nombre(s)" contiene "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
