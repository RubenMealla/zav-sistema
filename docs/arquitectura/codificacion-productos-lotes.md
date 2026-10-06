# Codificación de productos y lotes — ZAV 2026

**Estado:** PROPUESTO E IMPLEMENTADO EN RAMA para la ayuda de captura; sujeto a validación de la convención final con ZAV y, para el lote físico/etiquetado, a la documentación regulatoria aplicable.

## 1. Qué está confirmado por norma

### Identificación de lote

La normativa oficial consultada del SENASAG exige que el envase lleve una identificación de lote permanente, legible e indeleble, expresada en código o lenguaje claro, que permita identificar la empresa elaboradora y el lote. También indica que el uso de claves o códigos especiales debe ser informado al SENASAG.

Codex Alimentarius, en la Norma General para el Etiquetado de los Alimentos Preenvasados (CXS 1-1985), exige igualmente que cada envase permita identificar la fábrica productora y el lote. Codex define lote como una cantidad determinada de producto obtenida esencialmente bajo las mismas condiciones.

**Conclusión para el sistema:** el software debe conservar un código de lote único y trazable, pero las fuentes consultadas no fijan un patrón obligatorio como `TJ-ZAV-...`. Por ello, el formato concreto usado por el sistema es una **convención interna**, no un “código SENASAG”.

## 2. Código interno de producto

No se encontró en las disposiciones consultadas un formato oficial obligatorio para un SKU interno de producto.

Se adopta como convención operativa:

`SIGLA-###`

Ejemplos:

- `SAL-001` para una presentación de Salchichas;
- `CHO-004` para una presentación de Chorizos;
- `MTD-002` para una presentación de Mortadelas.

Reglas:

- mayúsculas;
- código único;
- prefijo corto derivado de la familia;
- correlativo numérico;
- editable por el Administrador;
- la base de datos mantiene la unicidad como control definitivo.

Este código **no reemplaza** un GTIN, registro sanitario ni identificador oficial externo.

## 3. Código de lote

Se adopta como propuesta interna editable:

`TJ-ZAV-CODIGO_PRODUCTO-AAAAMMDD-NN`

Ejemplo:

`TJ-ZAV-SAL-001-20261005-01`

Interpretación:

- `TJ`: referencia interna a Tarija;
- `ZAV`: empresa;
- `SAL-001`: producto interno;
- `20261005`: fecha real de elaboración;
- `01`: correlativo para diferenciar más de un lote del mismo producto y fecha.

La sugerencia se calcula automáticamente para reducir errores de digitación. El Administrador puede modificarla porque el código registrado en el sistema debe coincidir con el código real utilizado en el lote físico/etiquetado.

## 4. Fechas

Se distinguen tres conceptos:

- **Fecha de registro:** la genera el servidor al guardar. No es editable ni retrodatable por el usuario.
- **Fecha de elaboración:** se propone con la fecha actual. Puede ser anterior si ese es el dato real del lote; nunca puede ser futura.
- **Fecha de vencimiento:** no se autocompleta porque la vida útil depende del producto real. Debe ser posterior a la elaboración y no puede estar vencida al momento del ingreso.

No se genera una fecha de vencimiento ficticia ni se infiere vida útil sin evidencia técnica del producto.

## 5. Controles de integridad

- Código de producto único.
- Código de lote único.
- Solo letras, números, punto, guion y guion bajo en códigos.
- Cantidades enteras positivas.
- Vencimiento posterior a elaboración.
- Elaboración no futura.
- Vencimiento no pasado al registrar.
- Operaciones asociadas al usuario autenticado y con fecha/hora de servidor.
- Una sugerencia automática puede quedar obsoleta si dos operaciones concurrentes reciben el mismo siguiente correlativo; la restricción única de base de datos sigue siendo el control autoritativo.

## 6. Fuentes oficiales consultadas

- Servicio Nacional de Sanidad Agropecuaria e Inocuidad Alimentaria (SENASAG), Resolución Administrativa 42/2023, apartado de identificación del lote y etiquetado de alimentos destinados al consumo humano. Disponible en el portal oficial de normativa SENASAG: https://www.senasag.gob.bo/index.php/normativas-y-resoluciones/reglamento-y-resoluciones-administrativas/category/5455-2023?download=3485%3Ara-42-2023
- Codex Alimentarius, CXS 1-1985, *General Standard for the Labelling of Pre-packaged Foods*, apartado 4.6 Lot Identification. Portal oficial Codex/FAO: https://www.fao.org/fao-who-codexalimentarius/codex-texts/list-standards/en/?ids=91

**Pendiente de validar con ZAV:** si la empresa ya utiliza una codificación física de lotes aprobada/declarada, esa convención real debe prevalecer sobre la propuesta interna del sistema.
