# language: es
@plataforma @sesion @api @solo-web
Característica: Cookies de sesión de la plataforma
  Con HTTPS la cookie lleva el prefijo __Host- (Secure, Path=/ y sin Domain): cada dominio tiene la suya.

  @BE-14
  Escenario: La cookie de sesión es HttpOnly, SameSite=Lax, de todo el dominio y sin Domain
    Cuando creo una cuenta por la API
    Entonces la cookie "session" cumple las reglas de la plataforma

  @solo-lectura @BE-14
  Escenario: La cookie del acceso con Google cumple las mismas reglas
    Cuando pido un nonce de acceso con Google
    Entonces la cookie "google_nonce" cumple las reglas de la plataforma
