# language: es
# Solo web: la portada no existe dentro de las apps
@sitio @solo-web
Característica: La portada interactiva
  Las piezas de la portada que responden sin escribir datos: el ejemplo de asistencia, las preguntas
  frecuentes y los accesos directos a la creación de un evento.

  @solo-lectura
  Escenario: El ejemplo de asistencia cambia el conteo sin escribir en ningún evento
    Dado que abro la portada
    Entonces veo el texto "2 de 3 personas asistirán"
    Cuando en el ejemplo de asistencia respondo "Asistiré" por "Leo"
    Entonces veo el texto "3 de 3 personas asistirán"
    Cuando en el ejemplo de asistencia respondo "No podré" por "Ana"
    Entonces veo el texto "2 de 3 personas asistirán"

  @solo-lectura
  Escenario: Las preguntas frecuentes se abren desde el menú del teléfono
    Dado que abro la portada en un teléfono
    Cuando abro el menú del sitio
    Y pulso "Preguntas frecuentes" en la navegación del sitio
    Y pulso la pregunta "¿Mis invitados necesitan registrarse?"
    Entonces veo el texto "No. Abren su enlace privado y responden por cada integrante de la invitación, sin crear una cuenta."

  @solo-lectura
  Escenario: El acceso directo a crear un evento conserva la intención al entrar
    Dado que abro la portada en inglés
    Cuando pulso el enlace "Create my first event" de la portada
    Entonces estoy en la página de registro para crear un evento
    Cuando pulso el enlace "Sign in"
    Entonces estoy en la página de acceso para crear un evento
