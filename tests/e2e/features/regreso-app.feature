# language: es
# Solo en Android: el regreso usa un App Link, y en iOS el Universal Link exige el
# apple-app-site-association del dominio, que no existe hasta publicar la app. La parte de Google
# ocurre en el navegador y necesita una cuenta real: aquí el código lo autoriza la API, igual que
# lo haría la página «Conectar mi app».
@acceso @movil @solo-movil @sin-ios
Característica: Volver a la app después de entrar en el navegador
  La app abre el acceso en el navegador del sistema. Al terminar, un enlace verificado devuelve a la
  app un código de un solo uso, ligado a un verificador que solo guarda el teléfono.

  Escenario: El enlace de regreso abre la sesión en la app
    Dado que tengo un evento con una invitación para "Familia Pérez" creados por la API
    Cuando empiezo a entrar con Google desde la app
    Y el navegador devuelve a la app el enlace de regreso
    Entonces la app abre la sesión de mi cuenta
