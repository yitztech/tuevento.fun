# language: es
@api @registro @REQ-01
Característica: La API valida los datos de la cuenta
  La validación no puede depender del navegador: la API rechaza lo mismo
  aunque la petición no venga del formulario.

  Antecedentes:
    Dado un registro válido para la API

  @smoke
  Escenario: Acepta un registro válido
    Cuando lo envío a la API de registro
    Entonces la API responde 201

  @validacion @BE-26 @solo-lectura
  Esquema del escenario: Rechaza nombres con números o símbolos
    Cuando cambio "<campo>" por "<valor>"
    Y lo envío a la API de registro
    Entonces la API responde 422 con el mensaje "Usa solo letras, espacios, apóstrofo o guion."
    Y el error del campo "<campo>" tiene el código "invalid_characters"

    Ejemplos:
      | campo     | valor      |
      | nombre    | Ana2       |
      | apellidos | 123        |
      | nombre    | Ana_López  |
      | apellidos | <b>Ana</b> |

  @validacion @BE-26 @solo-lectura
  Esquema del escenario: Rechaza teléfonos con letras o sin dígitos suficientes
    Cuando cambio "teléfono" por "<valor>"
    Y lo envío a la API de registro
    Entonces la API responde 422
    Y el error del campo "teléfono" tiene el código "<código>"

    Ejemplos:
      | valor         | código             |
      | abc1234567    | invalid_characters |
      | 555-CALL-NOW  | invalid_characters |
      | +++++++       | invalid_characters |
      | 123456        | too_short          |
      | 1234567890123 | invalid_format     |

  @validacion @BE-26
  Escenario: Guarda el teléfono en formato internacional E.164
    Cuando cambio "teléfono" por "+52 (777) 123-45-67"
    Y lo envío a la API de registro
    Entonces la API responde 201
    Y la cuenta guarda el teléfono "+527771234567"

  @validacion @BE-11 @solo-lectura
  Escenario: Rechaza los campos que no son de la cuenta
    Cuando añado el campo "isOwner" con el valor verdadero
    Y lo envío a la API de registro
    Entonces la API responde 422
    Y el error del campo "isOwner" tiene el código "unknown_field"

  @limites @BE-26 @solo-lectura
  Esquema del escenario: Rechaza datos que superan la longitud máxima
    Cuando cambio "<campo>" por un texto de <largo> caracteres
    Y lo envío a la API de registro
    Entonces la API responde 422
    Y el error del campo "<campo>" tiene el código "too_long"

    Ejemplos:
      | campo      | largo |
      | nombre     | 51    |
      | apellidos  | 51    |
      | teléfono   | 21    |
      | correo     | 255   |
      | contraseña | 129   |

  @limites @BE-27 @solo-lectura
  Escenario: Un apellido muy largo recibe un solo error
    Cuando cambio "apellidos" por un texto de 101 caracteres
    Y lo envío a la API de registro
    Entonces la API responde 422
    Y el campo "apellidos" tiene un solo error con el mensaje "Máximo 50 caracteres."

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
