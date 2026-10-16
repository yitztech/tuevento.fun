# language: es
@api @registro
Característica: La API valida los datos de la cuenta
  La validación no puede depender del navegador: la API rechaza lo mismo
  aunque la petición no venga del formulario.

  Antecedentes:
    Dado un registro válido para la API

  @smoke
  Escenario: Acepta un registro válido
    Cuando lo envío a la API de registro
    Entonces la API responde 201

  @validacion
  Esquema del escenario: Rechaza nombres con números o símbolos
    Cuando cambio "<campo>" por "<valor>"
    Y lo envío a la API de registro
    Entonces la API responde 400 con el mensaje "Usa solo letras, espacios, apóstrofo o guion."

    Ejemplos:
      | campo     | valor      |
      | nombre    | Ana2       |
      | apellidos | 123        |
      | nombre    | Ana_López  |
      | apellidos | <b>Ana</b> |

  @validacion
  Esquema del escenario: Rechaza teléfonos con letras o sin dígitos suficientes
    Cuando cambio "teléfono" por "<valor>"
    Y lo envío a la API de registro
    Entonces la API responde 400

    Ejemplos:
      | valor         |
      | abc1234567    |
      | 555-CALL-NOW  |
      | +++++++       |
      | 123456        |

  @limites
  Esquema del escenario: Rechaza datos que superan la longitud máxima
    Cuando cambio "<campo>" por un texto de <largo> caracteres
    Y lo envío a la API de registro
    Entonces la API responde 400

    Ejemplos:
      | campo      | largo |
      | nombre     | 51    |
      | apellidos  | 51    |
      | teléfono   | 21    |
      | correo     | 255   |
      | contraseña | 129   |

  @limites
  Esquema del escenario: Acepta datos justo en la longitud máxima
    Cuando cambio "<campo>" por un texto de <largo> caracteres
    Y lo envío a la API de registro
    Entonces la API responde 201

    Ejemplos:
      | campo      | largo |
      | nombre     | 50    |
      | apellidos  | 50    |
      | correo     | 254   |
      | contraseña | 128   |
