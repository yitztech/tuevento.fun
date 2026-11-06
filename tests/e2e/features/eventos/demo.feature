# language: es
@demo @solo-web @REQ-05
Característica: La demostración
  Exige una cuenta y, ya dentro, abre un espacio con eventos de ejemplo.

  @solo-lectura
  Escenario: Sin sesión, la aplicación pide acceder y no abre una demostración
    Dado que abro la aplicación sin sesión
    Entonces estoy en la página de acceso

  @solo-lectura
  Escenario: El botón de demostración de la portada lleva al registro
    Dado que abro la página de inicio
    Cuando pulso el enlace "Ver la demostración" de la portada
    Entonces estoy en la página de registro

  Escenario: La demostración muestra los eventos de ejemplo
    Dado que tengo una cuenta creada y entro a mi espacio
    Cuando exploro la demostración
    Entonces veo el texto "La boda de Sofía & Alejandro"
    Y veo el texto "¡Felices 30, Mariana!"
