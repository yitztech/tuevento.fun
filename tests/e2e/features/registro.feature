# language: es
@registro @movil
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
    Entonces entro a mi espacio

  Escenario: El registro no pide nombre de usuario
    Entonces no existe el campo "Nombre de usuario"
    Y veo el campo "Correo electrónico"

  Escenario: Las etiquetas indican que pueden ser varios nombres y apellidos
    Entonces veo el campo "Nombre(s)"
    Y veo el campo "Apellido(s)"

  @i18n @solo-web
  Escenario: Las etiquetas se muestran en inglés en el dominio inglés
    Dado que abro la página de registro en inglés
    Entonces veo el campo "First name(s)"
    Y veo el campo "Last name(s)"
    Y no existe el campo "Username"

  @validacion
  Esquema del escenario: Nombre y apellidos descartan lo que no son letras
    Cuando escribo "<escrito>" en el campo "<campo>"
    Entonces el campo "<campo>" contiene "<queda>"

    Ejemplos:
      | campo       | escrito         | queda       |
      | Nombre(s)   | Ana123 Ma_ría   | Ana María   |
      | Apellido(s) | O'Connor9-Núñez | O'Connor-Núñez |
      | Nombre(s)   | 12345           |             |

  @validacion
  Esquema del escenario: El teléfono descarta las letras
    Cuando escribo "<escrito>" en el campo "Teléfono"
    Entonces el campo "Teléfono" contiene "<queda>"

    Ejemplos:
      | escrito              | queda            |
      | +52 abc 555-12(3)x4  | 555-12(3)4       |
      | llamame              |                  |

  @limites
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
  @limites @sin-ios
  Escenario: Un nombre muy largo se corta en el máximo permitido
    Cuando pego un texto de 60 letras en el campo "Nombre(s)"
    Entonces el campo "Nombre(s)" contiene "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
