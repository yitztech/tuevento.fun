# language: es
@disenos @solo-web
Característica: Postales hermanas en móviles y tabletas

  Esquema del escenario: El catálogo y el editor permiten usar las diez variantes nuevas
    Dado que abro el catálogo de postales con una cuenta nueva a <ancho> por <alto>
    Entonces las dieciséis postales cargan sin desbordamiento horizontal
    Y puedo abrir la vista previa de cada postal hermana
    Cuando elijo una postal invernal y guardo un evento
    Entonces el evento conserva el diseño invernal al volver a editarlo

    Ejemplos:
      | ancho | alto |
      | 320   | 568  |
      | 390   | 844  |
      | 844   | 390  |
      | 768   | 1024 |
      | 1024  | 768  |
      | 1180  | 820  |
      | 1440  | 900  |
