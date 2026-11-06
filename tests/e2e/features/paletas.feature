# language: es
@admin @solo-web @paletas
Característica: Paleta global del sitio
  El dueño puede probar una paleta y guardarla para quienes usan el sitio.

  Escenario: Previsualizar, cancelar y guardar una paleta
    Dado que soy dueño del sistema y abro la administración
    Cuando previsualizo la paleta "Mandarina y Frambuesa"
    Entonces la paleta seleccionada solo es una vista previa
    Cuando cancelo la vista previa de la paleta
    Entonces se restaura la paleta guardada
    Cuando guardo la paleta "Fucsia, Ciruela y Ámbar"
    Entonces la paleta guardada se mantiene al recargar y aparece en la portada
    Y el servidor rechaza guardar sin origen o con datos no válidos
