# language: es
@plataforma @seo @solo-lectura @solo-web
Característica: Cada URL en un solo estado para los buscadores
  Pública (200 y en el sitemap), privada (X-Robots-Tag: noindex), inexistente (404) o movida (301).
  Search Console avisa de cualquier otra cosa (AGENTS.md §9.2).

  @smoke @WEB-06
  Esquema del escenario: Una ruta que no existe responde 404 sin canonical
    Cuando pido "<ruta>" en el dominio en "<idioma>"
    Entonces la respuesta es 404
    Y la respuesta lleva X-Robots-Tag noindex
    Y el HTML no lleva canonical

    Ejemplos:
      | idioma | ruta              |
      | es     | /no-existe-prueba |
      | en     | /pt/no-existe     |
      | es     | /images/nada.jpg  |
      | es     | /k7p2x9q/boda-ana |
      | es     | /api/internal/seo/providers/salon |
      | es     | /vendors/salon-luna |

  @WEB-07
  Esquema del escenario: robots.txt no bloquea nada y lo privado lleva noindex en la cabecera
    Cuando pido "/robots.txt" en el dominio en "<idioma>"
    Entonces la respuesta es 200
    Y robots.txt no lleva Disallow y apunta a su sitemap
    Cuando pido "<privada>" en el dominio en "<idioma>"
    Entonces la respuesta es 200
    Y la respuesta lleva X-Robots-Tag noindex

    Ejemplos:
      | idioma | privada            |
      | es     | /app               |
      | es     | /e/una-celebracion |
      | en     | /eventos/1/editar  |
      | es     | /k7p2x9qa/boda-ana |
      | en     | /pt/k7p2x9qa/boda  |
      | es     | /api/search/providers?q=boda |

  @WEB-08
  Esquema del escenario: Cada URL del sitemap es pública y su canonical es ella misma
    Cuando pido "/sitemap.xml" en el dominio en "<idioma>"
    Entonces cada URL del sitemap responde 200 sin noindex y con su canonical

    Ejemplos:
      | idioma |
      | es     |
      | en     |

  @WEB-09
  Esquema del escenario: La otra forma de una URL redirige con 301 a la buena
    Cuando pido "<ruta>" en el dominio en "<idioma>"
    Entonces la respuesta es 301 hacia "<destino>"

    Ejemplos:
      | idioma | ruta        | destino |
      | es     | /precios/   | /precios |
      | es     | /index.html | /        |
      | en     | /pt         | /pt/     |
