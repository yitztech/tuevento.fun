disposition: fix

Limitación del proceso: la revisión independiente se interrumpió dos veces por límite de uso; esta consolidación se completó en el chat de implementación con las capturas y hallazgos que sí llegaron. La salida original del roll no se guardó: el seed 1b370c5d consta en el contrato y resumen de ejecución. No existe una tarjeta QUALITY BAR separada ni un comp aprobado.

## persistence

Capturas válidas del panel ES/EN, editor, catálogo, detalle, RSVP y TV; app ejecutada desde Docker en localhost. Ground blanco puro #fff confirmado en CSS y capturas; fotografías locales visibles, fuentes locales, detector previo sin hallazgos y procedencia registrada. Falta completar sidecar antes de entrega.

## fidelity

| Elemento | Evaluación | Evidencia |
| --- | --- | --- |
| TYPE | match | Bricolage para titulares y Manrope en controles; coincide con OWN-WORLD. |
| MATERIAL | match | Fotografías reales visibles en hero y seis temas, sin materiales simulados. |
| GROUND | match | Blanco puro conserva la condición explícita del usuario. |
| Topología | match | Navegación lateral, cabecera, bienvenida, hero fotográfico, métricas y eventos. |
| Idiomas | adaptation | Selector ES/EN y textos más largos responden a la petición adicional del usuario. |
| Identificación demo móvil | contradicted | La identificación está en la navegación cerrada; el panel visible necesita un aviso. |
| Semántica hero | contradicted | .banner-mini añade un kicker que la regla craft-floor rechaza. |

## ceiling

Composición coherente con una aplicación Operate. Las fotografías y tipos expresan el mundo elegido. La prioridad pendiente es legibilidad y manejo táctil; no hace falta añadir ornamentación.

## material_fixes

1. Mostrar un aviso de demostración visible en el panel sin abrir la navegación, con acceso a registro.
2. Retirar el kicker .banner-mini del hero y conservar el título y la fotografía.
3. Separar las dos frases del hero cuando el salto de línea se oculta en móvil; actualmente aparece people.And.
4. Mantener al menos 44 px en acciones principales móviles y selector de idioma; evitar hover verde en acciones destructivas.
5. Elevar a 11–12 px el texto de apoyo de métricas en móvil para que el desglose de personas sea legible.

## keep

Conservar fondo blanco, verde botella, fotografía, paleta celebratoria, jerarquía editorial y funcionalidad bilingüe completa.

## verdict

Revisión de cierre realizada en el chat de implementación, después de sustituir la revisión independiente interrumpida; no es un dictamen externo.

1. Resolved: el aviso de demostración se ve antes del hero en `dashboard-desktop.png` y `dashboard-en-mobile.png`, con acceso a registro.
2. Resolved: desapareció el kicker; título y fotografía permanecen en las mismas capturas.
3. Resolved: el texto inglés móvil separa «people. And» correctamente.
4. Resolved: acciones principales móviles y selector fijados a 44 px; acciones destructivas conservan fondo rojo/rosa al hover. Verificado en CSS final y controles capturados.
5. Resolved: desglose de métricas móvil aumentado a 11 px y etiquetas a 12 px, sin desbordamiento en la captura final.

## remaining

Clear para los cinco ajustes enumerados. La limitación de revisión independiente y los registros de dirección no guardados permanecen documentados; no se convierten en una aprobación externa. DESIGN.md y sidecar v2 con nueve componentes completados desde el código; seis imágenes con procedencia verificada.

disposition: ship — únicamente para los cinco ajustes revisados en este cierre.
