# language: es
@paletas-pantallas @solo-web
Característica: Las cuatro paletas en móvil, tableta y escritorio
  La paleta publicada se simula en la respuesta de la API: los escenarios no cambian la paleta global
  y pueden correr en paralelo con el resto.

  @REQ-PALETAS
  Esquema del escenario: La paleta se aplica con contraste suficiente en cada pantalla
    Dado que la paleta publicada es "<paleta>" en una pantalla de <ancho> por <alto>
    Entonces la portada usa la paleta, con foco visible y contraste suficiente
    Y la navegación del sitio usa la paleta
    Y el formulario de acceso muestra sus errores sin confundirlos con la paleta
    Y el panel y un modal usan la paleta, con contraste suficiente

    Ejemplos:
      | paleta             | ancho | alto |
      | fuchsia-plum-amber | 390   | 844  |
      | fuchsia-plum-amber | 820   | 1180 |
      | fuchsia-plum-amber | 1440  | 900  |
      | plum-champagne     | 390   | 844  |
      | plum-champagne     | 820   | 1180 |
      | plum-champagne     | 1440  | 900  |
      | mandarin-raspberry | 390   | 844  |
      | mandarin-raspberry | 820   | 1180 |
      | mandarin-raspberry | 1440  | 900  |
      | raspberry-vanilla  | 390   | 844  |
      | raspberry-vanilla  | 820   | 1180 |
      | raspberry-vanilla  | 1440  | 900  |
