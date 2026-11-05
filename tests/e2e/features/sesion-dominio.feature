# language: es
@plataforma @sesion @solo-web
Característica: La sesión es de cada dominio
  La cookie de sesión no lleva `Domain`: entrar en un dominio no abre sesión en el otro.

  Escenario: Entrar en un dominio no abre sesión en el otro
    Dado que tengo una cuenta creada y abro mi perfil
    Cuando abro "/app" en el dominio en "en"
    Entonces estoy en la página de acceso
    Cuando escribo mi correo y mi contraseña en inglés
    Y envío el formulario de acceso en inglés
    Entonces entro a mi espacio
