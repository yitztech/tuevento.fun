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
