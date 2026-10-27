# language: es
@proveedores @REQ-PROV-03
Característica: Perfil, servicios y fotos del proveedor
  Quien ofrece servicios completa los datos de su negocio, sus servicios y sus fotos, y publica su
  página solo cuando tiene lo necesario para que la encuentren.

  Antecedentes:
    Dado que tengo una cuenta de proveedor con la sesión abierta

  @solo-web @smoke
  Escenario: Completar el negocio, subir una foto y publicar la página
    Cuando abro la página "/negocio"
    Y escribo "Banquetes Lupita" en el campo "Nombre del negocio"
    Y marco la categoría "Banquetes y catering"
    Y escribo "hola@lupita.example" en el campo "Correo para clientes"
    Y pego el enlace de mapas "https://www.google.com/maps/place/X/@18.92,-99.23,17z"
    Y pulso el botón "Guardar mi negocio"
    Entonces veo el aviso "Los datos de tu negocio están guardados."
    Y para publicar solo falta "Al menos una foto"
    Y el botón "Publicar mi página" está desactivado
    Cuando abro la página "/negocio/fotos"
    Y subo una foto del negocio
    Y escribo "Mesa de banquete con flores blancas" en el campo "Descripción de la foto"
    Y pulso el botón "Guardar descripción"
    Entonces veo el aviso "Foto guardada."
    Cuando abro la página "/negocio"
    Y pulso el botón "Publicar mi página"
    Entonces veo el texto "Tu página está publicada"

  @solo-web
  Escenario: Añadir un servicio con precio «desde» y cambiarle el nombre
    Dado que ya guardé los datos de mi negocio
    Cuando abro la página "/negocio/servicios"
    Y pulso el botón "Añadir servicio"
    Y escribo "Banquete para 100" en el campo "Nombre del servicio"
    Y marco la opción "Mostrar un precio «desde»"
    Y escribo "15000" en el campo "Precio desde"
    Y pulso el botón "Guardar servicio"
    Entonces veo el aviso "Servicio guardado."
    Y veo el servicio "Banquete para 100" con el precio "Desde"
    Cuando edito el servicio "Banquete para 100"
    Y escribo "Banquete para 150" en el campo "Nombre del servicio"
    Y pulso el botón "Guardar servicio"
    Entonces veo el servicio "Banquete para 150" con el precio "Desde"

  @solo-web @validacion
  Escenario: Una foto que no es JPG, PNG ni WebP no se sube
    Dado que ya guardé los datos de mi negocio
    Cuando abro la página "/negocio/fotos"
    Y subo un archivo de texto como foto
    Entonces veo el texto "Aún no has subido fotos."
    Y veo la alerta "Usa una imagen PNG, JPG o WebP de hasta 2 MB."

  @solo-web
  Escenario: Sin guardar antes el negocio, los servicios piden empezar por él
    Cuando abro la página "/negocio/servicios"
    Y pulso el enlace "Ir a mi negocio"
    Entonces estoy en "/negocio"

  @solo-web @limites
  Escenario: El nombre del negocio tiene un máximo de caracteres
    Cuando abro la página "/negocio"
    Entonces el campo "Nombre del negocio" admite como máximo 150 caracteres
