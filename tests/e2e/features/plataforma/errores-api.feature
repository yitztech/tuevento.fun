# language: es
@plataforma @api @solo-web
Característica: Errores de la API en Problem Details y en el idioma del dominio
  Toda respuesta de error lleva type, title, status, code, detail y requestId (RFC 9457).

  @solo-lectura @smoke @BE-07
  Esquema del escenario: Sin sesión, lo privado responde 401 con el título en el idioma del dominio
    Cuando desde la portada en "<idioma>" pido a la API "/api/events"
    Entonces la API responde 401 en Problem Details con el código "unauthorized"
    Y el título del error es "<título>"
    Y la respuesta trae el idioma "<idioma>"

    Ejemplos:
      | idioma | título                  |
      | es     | Inicia sesión           |
      | en     | Sign in required        |
      | pt     | Entre na sua conta      |
      | de     | Anmeldung erforderlich  |
      | fr     | Connexion requise       |

  @solo-lectura @BE-07
  Escenario: Una ruta que no existe responde 404
    Cuando desde la portada en "es" pido a la API "/api/no-existe"
    Entonces la API responde 404 en Problem Details con el código "not_found"

  @solo-lectura @BE-07 @BE-11
  Esquema del escenario: Los datos no válidos responden 422 con el motivo en el idioma del dominio
    Cuando desde la portada en "<idioma>" me registro con el nombre "Ana2"
    Entonces la API responde 422 en Problem Details con el código "validation_failed"
    Y el campo "firstName" tiene el código "invalid_characters" y el mensaje de "validation.useLettersSpaces" en "<idioma>"

    Ejemplos:
      | idioma |
      | es     |
      | en     |
      | pt     |
      | de     |
      | fr     |

  @solo-lectura @BE-14
  Escenario: Una escritura desde un origen ajeno se rechaza con 403
    Cuando envío a la API una escritura con el origen "https://otro-sitio.example"
    Entonces la API responde 403 en Problem Details con el código "origin_not_allowed"

  @BE-07
  Escenario: Con sesión pero sin permiso, la API responde 403
    Dado que tengo una cuenta creada por la API
    Cuando desde la portada en "es" pido a la API "/api/owner/metrics"
    Entonces la API responde 403 en Problem Details con el código "forbidden"

  @BE-15
  Escenario: Pasado el límite de un formulario público, la API responde 429 con Retry-After
    Cuando me suscribo al boletín 4 veces con el mismo correo
    Entonces la última respuesta es 429 con Retry-After
