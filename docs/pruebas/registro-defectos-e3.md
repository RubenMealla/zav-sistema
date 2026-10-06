# Registro de defectos y retesting · E3

**Estado:** REGISTRO DE HALLAZGOS REALES CERRADOS O AISLADOS

| ID | Hallazgo | Severidad | Causa identificada | Corrección / decisión aplicada | Retest / estado |
|---|---|---:|---|---|---|
| DEF-01 | Suite de Pedidos no construía JwtAuthGuard | Alta | Dependencia de Usuario no disponible en el módulo | Registrar la entidad/dependencia requerida | Regresión backend: CORREGIDO |
| DEF-02 | Filtro de estado de Pedido fallaba | Alta | Placeholder SQL desalineado | Corregir parámetros y añadir E2E REGISTRADO/EN_DISTRIBUCION | E2E posterior: CORREGIDO |
| DEF-03 | APK y backend de desarrollo usaban contratos distintos | Alta | Entorno de API rezagado | Alinear contrato y endpoint utilizado por el APK estable | Validación posterior: CORREGIDO |
| DEF-04 | Mapa móvil en blanco / solapamiento Safe Area | Media-Alta | Composición nativa del mapa y barras Android | TextureView + SafeAreaProvider/SafeAreaView | Prueba física 04/10: CORREGIDO |
| DEF-05 | Selectores y acciones provocaban scroll excesivo | Media | Controles repetidos y listas crecientes | Búsqueda, filtros, historial y acciones contextuales | Validación física: CORREGIDO |
| DEF-06 | Nuevos Pedidos no entraban a un recorrido activo | Alta | El plan era tratado como conjunto cerrado | Recalcular y añadir paradas preservando las existentes | Validación física: CORREGIDO |
| DEF-07 | Reintento podía repetir operación crítica | Crítica | Riesgo de repetición por red | Claves idempotentes + bloqueo de estado/transacción | E2E retiro/entrega: CORREGIDO |
| DEF-08 | Interfaz web administrativa presentaba inconsistencias visuales | Media | Layout, controles y responsive heterogéneos | Consolidación de UI, validaciones y navegación | Playwright #651: CORREGIDO |
| DEF-09 | Automatización experimental de capturas Android no completó la navegación UI | Baja | El emulador inició y el APK se instaló, pero UIAutomator no detectó el texto esperado de la pantalla React Native | Se aisló el problema al workflow experimental; no se utiliza como sustituto de la prueba física ni del pipeline oficial de APK | APK oficial #247: SUCCESS; QA mobile #445: SUCCESS; validación física 04/10: CONFIRMADA |

## Criterio de cierre

Un defecto se considera corregido únicamente cuando existe retest. Una incidencia aislada de una herramienta auxiliar no se presenta como fallo funcional del sistema si las pruebas que verifican el producto permanecen satisfactorias y la relación está documentada.

## Ejecuciones de regresión utilizadas para el cierre

- QA backend #609: 13 pruebas unitarias y 26 E2E satisfactorias.
- QA web Playwright #651: 14 pruebas satisfactorias.
- QA mobile #445: lint y TypeScript satisfactorios.
- APK móvil E3 #247: compilación, firma, identidad y bundle verificados.
