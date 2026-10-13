import { InicialZav1790208000000 } from '../migrations/1790208000000-inicial.mjs';
import { LoteCondicionHistorial1790294400000 } from '../migrations/1790294400000-lote-condicion-historial.mjs';
import { SaldoInventarioVista1790380800000 } from '../migrations/1790380800000-saldos-derivados.mjs';
import { RetirarExistencia1790384400000 } from '../migrations/1790384400000-retirar-existencia.mjs';
import { PedidosDistribucion1790470800000 } from '../migrations/1790470800000-pedidos-distribucion.mjs';
import { GeolocalizacionDistribucion1790557200000 } from '../migrations/1790557200000-geolocalizacion-distribucion.mjs';
import { CierreClientesPedidosE31791104400000 } from '../migrations/1791104400000-cierre-clientes-pedidos-e3.mjs';
import { CatalogoAdministrable1791856800000 } from '../migrations/1791856800000-catalogo-administrable.mjs';
import { NormalizacionCatalogoCompatible1791856860000 } from '../migrations/1791856860000-normalizacion-catalogo-compatible.mjs';
import { OperacionesCustodia1791856920000 } from '../migrations/1791856920000-operaciones-custodia.mjs';

export const MIGRACIONES_ZAV = [
  InicialZav1790208000000,
  LoteCondicionHistorial1790294400000,
  SaldoInventarioVista1790380800000,
  RetirarExistencia1790384400000,
  PedidosDistribucion1790470800000,
  GeolocalizacionDistribucion1790557200000,
  CierreClientesPedidosE31791104400000,
  CatalogoAdministrable1791856800000,
  NormalizacionCatalogoCompatible1791856860000,
  OperacionesCustodia1791856920000,
];
