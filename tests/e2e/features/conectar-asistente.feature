# language: es
# El cliente es el fijo de pruebas (MCP_TEST_MODE): la conexión real con ChatGPT necesita su cuenta y
# un dominio público. El flujo completo por la API está en tests/api/test-endpoints.mjs.
@asistente @solo-web
Característica: Conectar un asistente a la cuenta
  Un asistente pide acceso a la cuenta. La persona entra, ve que solo podrá consultar sus datos y
  decide si lo permite.

  Escenario: Permitir el acceso devuelve el código al asistente
    Dado que un asistente pide acceso a mi cuenta sin que yo haya entrado
    Cuando entro con mi cuenta para conectar el asistente
    Entonces veo que "Cliente de pruebas" solo podrá consultar mis datos
    Cuando pulso "Permitir el acceso"
    Entonces el asistente recibe un código de autorización

  Escenario: No permitir el acceso devuelve el rechazo al asistente
    Dado que un asistente pide acceso a mi cuenta sin que yo haya entrado
    Cuando entro con mi cuenta para conectar el asistente
    Y pulso "No permitir"
    Entonces el asistente recibe el rechazo

  @validacion
  Escenario: Un enlace de conexión caducado no deja continuar
    Dado que abro un enlace de conexión de asistente que ya no vale
    Cuando entro con mi cuenta para conectar el asistente
    Entonces veo el texto "Este enlace de conexión caducó o no es válido"

  @i18n
  Esquema del escenario: El consentimiento sale en el idioma que pide el asistente
    Dado que tengo sesión en el dominio de "<idioma>"
    Cuando un asistente pide acceso en "<idioma>"
    Entonces veo el consentimiento en "<ruta>" con el título "<titulo>"

    Ejemplos:
      | idioma | ruta                       | titulo                      |
      | es     | /conectar-asistente        | Conecta tu asistente        |
      | en     | /conectar-asistente        | Connect your assistant      |
      | pt     | /pt/conectar-asistente     | Conecte seu assistente      |
      | de     | /de/conectar-asistente     | Verbinde deinen Assistenten |
      | fr     | /fr/conectar-asistente     | Connecte ton assistant      |

  @i18n
  Escenario: Sin sesión, el acceso también sale en el idioma pedido y vuelve al consentimiento
    Dado que un asistente pide acceso en "pt" sin que yo haya entrado
    Entonces veo el acceso en "/pt/acceso" para conectar el asistente
