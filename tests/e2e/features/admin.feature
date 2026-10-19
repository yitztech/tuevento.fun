# language: es
@admin @solo-web
Característica: Panel de administración

  Escenario: Una contraseña incorrecta no deja entrar
    Cuando abro el panel de administración
    Y entro al panel con el usuario "admin-dev" y la contraseña "clave-equivocada-1"
    Entonces veo el error "Usuario o contraseña incorrectos." del panel

  Escenario: El administrador entra y ve el resumen del sitio
    Cuando abro el panel de administración
    Y entro al panel con el usuario "admin-dev" y la contraseña "admin-dev-password"
    Entonces veo el resumen del panel con "Conectados ahora" y "Usuarios registrados"

  Escenario: Sin sesión, las estadísticas no se ven
    Cuando pido las estadísticas del panel sin haber entrado
    Entonces el panel responde 401

  Escenario: La salud del panel comprueba que puede leer la base de datos
    Cuando pido la salud del panel
    Entonces el panel responde 200 con el estado "ok"

  Escenario: El panel se usa en un móvil sin desbordamiento horizontal
    Dado que el panel se abre en un móvil de 390 por 844
    Cuando abro el panel de administración
    Y entro al panel con el usuario "admin-dev" y la contraseña "admin-dev-password"
    Entonces el panel cabe en pantalla sin desbordamiento horizontal

  Escenario: El administrador sale del panel
    Cuando abro el panel de administración
    Y entro al panel con el usuario "admin-dev" y la contraseña "admin-dev-password"
    Y salgo del panel
    Entonces veo el formulario de entrada del panel
