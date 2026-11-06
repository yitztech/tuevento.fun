# language: es
@perfil @movil @REQ-02
Característica: El perfil dentro de la app
  En la app nativa la sesión se abre por el formulario (no por la API del navegador) y la
  página de perfil se comporta igual que en la web.

  Escenario: Cambiar el nombre desde la app
    Dado que tengo una cuenta creada por la API sin sesión en el navegador
    Y entro en la app con mi cuenta
    Cuando abro la página "/perfil"
    Y elijo editar mi información
    Y escribo "Lucía" en el campo "Nombre"
    Y guardo los cambios del perfil
    Entonces veo el aviso "Tu perfil está actualizado."

  Escenario: El perfil de la app no muestra nombre de usuario
    Dado que tengo una cuenta creada por la API sin sesión en el navegador
    Y entro en la app con mi cuenta
    Cuando abro la página "/perfil"
    Entonces no existe el campo "Nombre de usuario"
    Y el campo "Nombre" contiene "Paula"
