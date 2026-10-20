# language: es
@plataforma @solo-lectura @api
Característica: Salud y versión publicadas
  Uptime Kuma y el despliegue comprueban el sitio sin sesión ni datos internos.

  @smoke @BE-01
  Escenario: La salud de la API solo dice el estado
    Cuando pido la salud de la API
    Entonces la API responde 200
    Y la salud responde solo el estado "ok"

  @smoke @DEP-11
  Escenario: La versión publicada indica la revisión desplegada
    Cuando pido la versión publicada
    Entonces la versión trae la revisión desplegada
