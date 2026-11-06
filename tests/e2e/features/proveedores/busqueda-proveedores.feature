# language: es
@busqueda @proveedores @REQ-PROV-06
Característica: Buscar proveedores
  Cualquiera, con o sin cuenta, busca negocios publicados por texto, categoría y ubicación en
  /proveedores (y su ruta en cada idioma). Los filtros viven en la URL para compartir la búsqueda.

  @smoke @movil
  Escenario: Encuentro un negocio aunque escriba su nombre con una errata
    Dado que hay un negocio publicado llamado "Banquetes Lupita"
    Cuando busco su nombre escrito como "Banquetez Lupitta" en la página de proveedores
    Entonces veo su tarjeta en los resultados

  @movil @validacion
  Escenario: Sin resultados, la página lo dice y ofrece quitar los filtros
    Cuando busco un texto que ningún negocio tiene en la página de proveedores
    Entonces veo que no hay proveedores con esos filtros
    Cuando quito los filtros
    Entonces el campo "¿Qué buscas?" contiene ""

  # @solo-web: marca casillas y lee la dirección de la página; las categorías en las apps son el mismo componente
  @solo-web
  Escenario: Una categoría deja solo sus negocios y queda en la dirección para compartirla
    Dado que hay un negocio de "Banquetes y catering" y otro de "DJ" con el mismo nombre
    Cuando busco ese nombre en la página de proveedores
    Entonces veo 2 tarjetas de ese nombre
    Cuando marco la categoría "DJ"
    Entonces veo solo la tarjeta del negocio de "DJ"
    Y la dirección de la página lleva la categoría "dj"

  # @solo-web: la ubicación del navegador se simula con Playwright; en las apps la da el plugin de Capacitor
  @solo-web
  Escenario: Cerca de mí muestra lo que está dentro de la distancia y no lo que queda fuera
    Dado que hay un negocio a 5 km de mí y otro a 60 km
    Cuando abro la página de proveedores y busco cerca de mí
    Entonces veo la tarjeta del negocio a 5 km con su distancia
    Y no veo la tarjeta del negocio a 60 km
    Cuando amplío la distancia a "Hasta 100 km"
    Entonces veo la tarjeta del negocio a 60 km

  # @solo-web: cuenta tarjetas en la página
  @solo-web
  Escenario: «Cargar más» trae la página siguiente sin repetir negocios
    Dado que hay 21 negocios publicados llamados "Florería Azahar"
    Cuando busco ese nombre en la página de proveedores
    Entonces veo 20 tarjetas de ese nombre
    Cuando cargo más resultados
    Entonces veo 21 tarjetas de ese nombre, sin repetidas

  @i18n @solo-lectura
  Esquema del escenario: La página y los nombres de las categorías están en el idioma del dominio
    Cuando abro la página de proveedores en "<idioma>"
    Entonces veo el título "<titulo>"
    Y veo la categoría "<categoria>"

    Ejemplos:
      | idioma | titulo                              | categoria                    |
      | es     | Proveedores para tu evento          | Sillas, mesas y carpas       |
      | en     | Vendors for your event              | Chairs, tables and tents     |
      | pt     | Fornecedores para o seu evento      | Cadeiras, mesas e tendas     |
      | de     | Dienstleister für dein Event        | Stühle, Tische und Zelte     |
      | fr     | Des prestataires pour ton événement | Chaises, tables et chapiteaux |

  @api @seo @solo-lectura @solo-web
  Escenario: La búsqueda es una página pública con su canonical sin filtros y está en el sitemap
    Cuando pido "/proveedores?q=boda&cat=dj" en el dominio en "es"
    Entonces la respuesta es 200
    Y el canonical es "/proveedores" sin parámetros
    Cuando pido "/sitemap.xml" en el dominio en "en"
    Entonces el sitemap lista "/vendors", "/pt/fornecedores", "/de/dienstleister" y "/fr/prestataires"
