# language: es
@demo @solo-web
Característica: La demostración exige registrarse

  Escenario: Sin sesión, la aplicación pide acceder y no abre una demostración
    Dado que abro la aplicación sin sesión
    Entonces estoy en la página de acceso

  Escenario: El botón de demostración de la portada lleva al registro
    Dado que abro la página de inicio
    Cuando pulso el enlace "Ver la demostración" de la portada
    Entonces estoy en la página de registro
