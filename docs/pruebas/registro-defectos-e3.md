# Registro de defectos y retesting · E3

Estado: **REGISTRO DE HALLAZGOS REALES**

| ID | Hallazgo | Severidad | Causa identificada | Corrección aplicada | Retest / estado |
|---|---|---|---|---|---|
| DEF-01 | Suite de Pedidos no construía JwtAuthGuard | Alta | Dependencia de Usuario no disponible en el módulo | Registrar la entidad/dependencia requerida | Regresión backend posterior: **CORREGIDO** |
| DEF-02 | Filtro de estado de Pedido fallaba | Alta | Placeholder SQL desalineado | Corregir parámetros y añadir E2E REGISTRADO/EN_DISTRIBUCION | E2E posterior: **CORREGIDO** |
| DEF-03 | APK y backend development usaban contratos distintos | Alta | API development rezagada | Separar entorno development, migrar y revalidar | Validación posterior: **CORREGIDO** |
| DEF-04 | Mapa móvil en blanco / solapamiento Safe Area | Media-Alta | Composición nativa del mapa y barras Android | TextureView + SafeAreaProvider/SafeAreaView | Prueba física 04/10: **CORREGIDO** |
| DEF-05 | Selectores y acciones provocaban scroll excesivo | Media | Controles repetidos y listas crecientes | Búsqueda, filtros, historial y acciones contextuales | Validación física: **CORREGIDO** |
| DEF-06 | Nuevos pedidos no entraban a un recorrido activo | Alta | El plan era tratado como conjunto cerrado | Recalcular y añadir paradas preservando las existentes | Validación física: **CORREGIDO** |
| DEF-07 | Reintento podía repetir operación crítica | Crítica | Riesgo de repetición por red | Claves idempotentes + bloqueo de estado/transacción | E2E retiro/entrega: **CORREGIDO** |
| DEF-08 | Interfaz web administrativa necesitaba consolidación visual | Media | Inconsistencias de layout y controles | Rama `mejora/ui-web-consolidada` + QA responsivo | Playwright #484: **PASS; PENDIENTE DE APROBACIÓN/MERGE** |

## Política de cierre

Un defecto solo se marca como corregido cuando existe retest. Los hallazgos de una rama todavía no integrada se mantienen como **PENDIENTE DE MERGE** aunque su QA sea satisfactorio.
