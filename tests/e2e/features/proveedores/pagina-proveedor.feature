# language: es
# @solo-web: la página pública se abre desde enlaces compartidos y los buscadores, en el navegador;
# en las apps se ve con el mismo componente (mismos pasos de interfaz cubiertos aquí).
@proveedores @solo-web @REQ-PROV-04
Característica: Página pública del proveedor
  Cada negocio publicado tiene su página, en cada idioma, para que quien organiza un evento lo
  conozca y le escriba. Para los buscadores, cada dirección está en un solo estado.

  Antecedentes:
    Dado que hay un proveedor publicado con 2 fotos

  @smoke @i18n
  Esquema del escenario: La página muestra el negocio y WhatsApp lleva el mensaje en el idioma de la página
    Cuando abro su página en "<idioma>"
    Entonces veo el nombre del negocio como título principal
    Y el botón de WhatsApp abre el chat del negocio con el mensaje en "<idioma>"

    Ejemplos:
      | idioma |
      | es     |
      | en     |
      | pt     |
      | de     |
      | fr     |

  Escenario: La galería se recorre con el teclado y Esc la cierra
    Cuando abro su página en "es"
    Y abro la foto 1 de la galería
    Entonces veo el visor "Foto 1 de 2"
    Cuando pulso la tecla "ArrowRight"
    Entonces veo el visor "Foto 2 de 2"
    Cuando pulso la tecla "Escape"
    Entonces el visor está cerrado y el foco está en la foto 2 de la galería

  @api @seo @WEB-06
  Escenario: Publicada responde 200 con su título y su canonical, sin JavaScript
    Cuando pido su página en el dominio en "es"
    Entonces la respuesta es 200
    Y el HTML lleva el nombre del negocio en el título y su propia URL como canonical
    Cuando pido su página en el dominio en "pt"
    Entonces la respuesta es 200
    Y el HTML lleva el nombre del negocio en el título y su propia URL como canonical

  @api @seo @WEB-09
  Escenario: La dirección anterior redirige con 301 a la nueva
    Cuando el negocio cambia la dirección de su página
    Y pido su dirección anterior en el dominio en "es"
    Entonces la respuesta es 301 hacia su dirección nueva

  @api @seo
  Escenario: Despublicada responde 404 y borrada, 410, las dos con noindex
    Cuando el negocio despublica su página
    Y pido su página en el dominio en "es"
    Entonces la respuesta es 404
    Y la respuesta lleva X-Robots-Tag noindex
    Cuando se borra la cuenta del negocio
    Y pido su página en el dominio en "es"
    Entonces la respuesta es 410
    Y la respuesta lleva X-Robots-Tag noindex

  @api @seo @WEB-08
  Escenario: El sitemap de proveedores lista la página en cada idioma del dominio
    Cuando pido "/sitemap-providers.xml" en el dominio en "en"
    Entonces el sitemap lista su página en "en", "pt", "de" y "fr" y cada una responde 200 con su canonical
