import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { objeto, uuid } from '../inventario/validacion.js';

const CAMPOS_PLANIFICACION = [
  'pedidoIds',
  'origenTipo',
  'origenLatitud',
  'origenLongitud',
] as const;
const CAMPOS_GEORREFERENCIA = ['latitud', 'longitud'] as const;

type Punto = { latitud: number; longitud: number };
type Parada = Punto & {
  pedidoId: string;
  clienteId: string;
  clienteNombre: string;
  direccionEntrega: string;
};

function coordenada(valor: unknown, campo: string, minimo: number, maximo: number): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < minimo || valor > maximo) {
    throw new BadRequestException(`${campo} debe estar entre ${minimo} y ${maximo}.`);
  }
  return valor;
}

function distanciaHaversine(a: Punto, b: Punto): number {
  const radioTierraM = 6371008.8;
  const rad = (grados: number) => (grados * Math.PI) / 180;
  const dLat = rad(b.latitud - a.latitud);
  const dLon = rad(b.longitud - a.longitud);
  const lat1 = rad(a.latitud);
  const lat2 = rad(b.latitud);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radioTierraM * Math.asin(Math.min(1, Math.sqrt(h)));
}

@Injectable()
export class GeografiaService {
  constructor(private readonly db: DataSource) {}

  async ventaDespacho() {
    const filas = await this.db.query(
      `SELECT id, codigo, nombre, clase, latitud, longitud
       FROM ubicacion
       WHERE codigo = 'VENTA_DESPACHO' AND activa = TRUE
       LIMIT 1`,
    ) as Array<Record<string, unknown>>;

    if (!filas.length) throw new NotFoundException('Venta y Despacho no esta configurado.');
    const fila = filas[0];
    return {
      id: fila.id,
      codigo: fila.codigo,
      nombre: fila.nombre,
      clase: fila.clase,
      ubicacion:
        fila.latitud === null
          ? null
          : { latitud: Number(fila.latitud), longitud: Number(fila.longitud) },
    };
  }

  async actualizarUbicacionFisica(idEntrada: string, entrada: unknown) {
    const id = uuid(idEntrada, 'id');
    const datos = objeto(entrada, CAMPOS_GEORREFERENCIA);
    const latitud = coordenada(datos.latitud, 'latitud', -90, 90);
    const longitud = coordenada(datos.longitud, 'longitud', -180, 180);

    const filas = await this.db.query(
      `UPDATE ubicacion
       SET latitud = $2, longitud = $3
       WHERE id = $1::uuid AND activa = TRUE AND clase = 'AREA_FISICA'
       RETURNING id, codigo, nombre, clase, latitud, longitud`,
      [id, latitud, longitud],
    ) as Array<Record<string, unknown>>;

    if (!filas.length) {
      const existe = await this.db.query(
        'SELECT id, clase FROM ubicacion WHERE id = $1::uuid',
        [id],
      ) as Array<{ id: string; clase: string }>;
      if (!existe.length) throw new NotFoundException('Ubicacion no encontrada.');
      throw new ConflictException('Solo las ubicaciones fisicas pueden tener georreferencia fija.');
    }

    return {
      id: filas[0].id,
      codigo: filas[0].codigo,
      nombre: filas[0].nombre,
      clase: filas[0].clase,
      ubicacion: {
        latitud: Number(filas[0].latitud),
        longitud: Number(filas[0].longitud),
      },
    };
  }

  async planificar(entrada: unknown, vendedorId: string) {
    const datos = objeto(entrada, CAMPOS_PLANIFICACION);
    if (!Array.isArray(datos.pedidoIds) || datos.pedidoIds.length < 2 || datos.pedidoIds.length > 20) {
      throw new BadRequestException('pedidoIds debe contener entre 2 y 20 pedidos.');
    }

    const pedidoIds = datos.pedidoIds.map((valor, indice) =>
      uuid(valor, `pedidoIds[${indice}]`),
    );
    if (new Set(pedidoIds).size !== pedidoIds.length) {
      throw new BadRequestException('pedidoIds no puede contener duplicados.');
    }

    let origen: Punto;
    let origenTipo: 'DESPACHO' | 'ACTUAL';
    if (datos.origenTipo === 'DESPACHO') {
      origenTipo = 'DESPACHO';
      const despacho = await this.ventaDespacho();
      if (!despacho.ubicacion) {
        throw new ConflictException(
          'Venta y Despacho todavia no tiene coordenadas configuradas.',
        );
      }
      origen = despacho.ubicacion;
    } else if (datos.origenTipo === 'ACTUAL') {
      origenTipo = 'ACTUAL';
      origen = {
        latitud: coordenada(datos.origenLatitud, 'origenLatitud', -90, 90),
        longitud: coordenada(datos.origenLongitud, 'origenLongitud', -180, 180),
      };
    } else {
      throw new BadRequestException('origenTipo debe ser DESPACHO o ACTUAL.');
    }

    const filas = await this.db.query(
      `SELECT pe.id AS pedido_id, pe.destino_latitud, pe.destino_longitud,
              pe.direccion_entrega, c.id AS cliente_id, c.nombre AS cliente_nombre
       FROM pedido pe
       JOIN cliente c ON c.id = pe.cliente_id
       WHERE pe.id = ANY($1::uuid[])
         AND pe.vendedor_id = $2::uuid
         AND pe.estado IN ('REGISTRADO', 'EN_DISTRIBUCION')`,
      [pedidoIds, vendedorId],
    ) as Array<{
      pedido_id: string;
      destino_latitud: string | null;
      destino_longitud: string | null;
      direccion_entrega: string;
      cliente_id: string;
      cliente_nombre: string;
    }>;

    if (filas.length !== pedidoIds.length) {
      throw new NotFoundException(
        'Uno o mas pedidos no existen, no pertenecen al Vendedor o no estan disponibles para reparto.',
      );
    }

    const sinUbicacion = filas.filter(
      (fila) => fila.destino_latitud === null || fila.destino_longitud === null,
    );
    if (sinUbicacion.length) {
      throw new ConflictException(
        'Todos los pedidos seleccionados deben tener un destino georreferenciado.',
      );
    }

    const pendientes: Parada[] = filas.map((fila) => ({
      pedidoId: fila.pedido_id,
      clienteId: fila.cliente_id,
      clienteNombre: fila.cliente_nombre,
      direccionEntrega: fila.direccion_entrega,
      latitud: Number(fila.destino_latitud),
      longitud: Number(fila.destino_longitud),
    }));

    const ordenadas: Array<Parada & { orden: number; distanciaDesdeAnteriorMetros: number }> = [];
    let actual = origen;
    let total = 0;

    while (pendientes.length) {
      let mejorIndice = 0;
      let mejorDistancia = distanciaHaversine(actual, pendientes[0]);

      for (let i = 1; i < pendientes.length; i += 1) {
        const distancia = distanciaHaversine(actual, pendientes[i]);
        if (
          distancia < mejorDistancia ||
          (Math.abs(distancia - mejorDistancia) < 0.001 &&
            pendientes[i].pedidoId.localeCompare(pendientes[mejorIndice].pedidoId) < 0)
        ) {
          mejorIndice = i;
          mejorDistancia = distancia;
        }
      }

      const [siguiente] = pendientes.splice(mejorIndice, 1);
      const distanciaRedondeada = Math.round(mejorDistancia);
      total += mejorDistancia;
      ordenadas.push({
        ...siguiente,
        orden: ordenadas.length + 1,
        distanciaDesdeAnteriorMetros: distanciaRedondeada,
      });
      actual = siguiente;
    }

    return {
      algoritmo: 'VECINO_MAS_CERCANO_HAVERSINE',
      naturaleza: 'SECUENCIA_GEOGRAFICA_SUGERIDA',
      origen: { tipo: origenTipo, ...origen },
      distanciaTotalAproximadaMetros: Math.round(total),
      paradas: ordenadas,
      limitacion:
        'Las distancias son geodesicas; no consideran calles, trafico, horarios ni restricciones viales.',
    };
  }
}

export { distanciaHaversine };
