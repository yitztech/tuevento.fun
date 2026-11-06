# language: es
@admin @solo-web @paletas
Característica: Paleta global del sitio
  Solo el panel de administración cambia la paleta de quienes usan el sitio.

  Escenario: El administrador guarda una paleta desde el panel
    Dado que el sitio usa la paleta inicial
    Cuando abro el panel de administración
    Y entro al panel con el usuario "admin" y la contraseña "Password.Password.1"
    Y guardo la paleta "Fucsia, Ciruela y Ámbar" en el panel
    Entonces la paleta guardada se mantiene al recargar el panel y aparece en la portada
    Y el cambio de paleta queda registrado con quien lo hizo

  Escenario: El dueño del sitio ya no puede cambiar la paleta
    Dado que soy dueño del sistema y abro la administración
    Entonces no veo la paleta del sitio
    Y la API de la web no permite guardar la paleta

  @solo-lectura
  Escenario: Sin sesión, el panel no cambia la paleta
    Cuando guardo una paleta en el panel sin haber entrado
    Entonces el panel responde 401
