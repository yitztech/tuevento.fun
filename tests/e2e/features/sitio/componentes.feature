# language: es
@componentes
Característica: Componentes de la interfaz
  Los filtros, las ventanas y los avisos de la web son componentes de shadcn/ui: se manejan con
  teclado y anuncian su estado a los lectores de pantalla.

  Escenario: El filtro de mis eventos marca la opción elegida
    Dado que tengo una cuenta creada y entro a mi espacio
    Cuando abro la página "/eventos"
    Entonces la opción "Próximos" está elegida
    Cuando elijo la opción "Pasados"
    Entonces la opción "Pasados" está elegida

  Escenario: El aviso se cierra con su botón
    Dado que tengo una cuenta creada y abro mi perfil
    Cuando guardo los cambios del perfil
    Entonces veo el aviso "Tu perfil está actualizado."
    Cuando pulso el botón "Cerrar aviso"
    Entonces no veo el texto "Tu perfil está actualizado."
