import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
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

function coordenadaConsulta(
  valor: unknown,
  campo: string,
  minimo: number,
  maximo: number,
): number {
  const numero =
    typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : valor;
  return coordenada(numero, campo, minimo, maximo);
}

function consultaDireccion(valor: unknown): string {
  if (typeof valor !== 'string') {
    throw new BadRequestException('q es obligatorio.');
  }
  const consulta = valor.trim();
  if (consulta.length < 1 || consulta.length > 200) {
    throw new BadRequestException('q debe contener entre 1 y 200 caracteres.');
  }
  return consulta;
}

type GeoapifyResultado = {
  formatted?: unknown;
  address_line1?: unknown;
  address_line2?: unknown;
  name?: unknown;
  street?: unknown;
  housenumber?: unknown;
  suburb?: unknown;
  district?: unknown;
  city?: unknown;
  county?: unknown;
  state?: unknown;
  country?: unknown;
  country_code?: unknown;
  result_type?: unknown;
  lat?: unknown;
  lon?: unknown;
};

type GeoapifyRespuesta = {
  results?: GeoapifyResultado[];
};

function textoOpcional(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : '';
}

function esPlusCode(valor: string): boolean {
  return /^[A-Z0-9]{4,8}\+[A-Z0-9]{2,4}$/i.test(valor.trim());
}

function direccionHumana(resultado: GeoapifyResultado): string {
  const linea1 = textoOpcional(resultado.address_line1);
  const nombre = textoOpcional(resultado.name);
  const calle = textoOpcional(resultado.street);
  const numero = textoOpcional(resultado.housenumber);
  const principal =
    linea1 && !esPlusCode(linea1)
      ? linea1
      : [nombre && !esPlusCode(nombre) ? nombre : '', calle, numero]
          .filter(Boolean)
          .join(' ');

  const partes = [
    principal,
    textoOpcional(resultado.suburb),
    textoOpcional(resultado.district),
    textoOpcional(resultado.city),
    textoOpcional(resultado.county),
    textoOpcional(resultado.state),
  ]
    .filter(Boolean)
    .filter((valor, indice, todos) => todos.indexOf(valor) === indice);

  if (partes.length) return partes.join(', ');

  const formateada = textoOpcional(resultado.formatted);
  return formateada.replace(/^[A-Z0-9]{4,8}\+[A-Z0-9]{2,4},?\s*/i, '');
}

function normalizarResultado(resultado: GeoapifyResultado) {
  const direccion = direccionHumana(resultado);
  const latitud = Number(resultado.lat);
  const longitud = Number(resultado.lon);
  if (!direccion || !Number.isFinite(latitud) || !Number.isFinite(longitud)) {
    return null;
  }

  return {
    direccion,
    principal:
      textoOpcional(resultado.address_line1) ||
      textoOpcional(resultado.name) ||
      textoOpcional(resultado.street) ||
      direccion.split(',')[0],
    secundaria: [
      textoOpcional(resultado.suburb),
      textoOpcional(resultado.district),
      textoOpcional(resultado.city),
      textoOpcional(resultado.state),
    ]
      .filter(Boolean)
      .filter((valor, indice, todos) => todos.indexOf(valor) === indice)
      .join(', '),
    tipo: textoOpcional(resultado.result_type) || 'unknown',
    departamento: textoOpcional(resultado.state) || null,
    ciudad: textoOpcional(resultado.city) || null,
    paisCodigo: textoOpcional(resultado.country_code).toLowerCase() || null,
    latitud,
    longitud,
  };
}

function esTarija(resultado: ReturnType<typeof normalizarResultado>): boolean {
  if (!resultado || resultado.paisCodigo !== 'bo') return false;
  return [resultado.departamento, resultado.ciudad, resultado.secundaria]
    .filter((valor): valor is string => Boolean(valor))
    .some((valor) => valor.toLocaleLowerCase('es-BO').includes('tarija'));
}

function prioridadTipo(tipo: string): number {
  const prioridades: Record<string, number> = {
    suburb: 0,
    district: 1,
    neighbourhood: 2,
    street: 3,
    city: 4,
    town: 5,
    village: 6,
    locality: 7,
    amenity: 8,
    building: 9,
  };
  return prioridades[tipo] ?? 10;
}

function combinarResultados(
  prioritarios: GeoapifyResultado[],
  generales: GeoapifyResultado[],
) {
  const mapa = new Map<string, NonNullable<ReturnType<typeof normalizarResultado>>>();
  for (const bruto of [...prioritarios, ...generales]) {
    const resultado = normalizarResultado(bruto);
    if (!resultado || !esTarija(resultado)) continue;
    const clave = `${resultado.latitud.toFixed(5)}:${resultado.longitud.toFixed(5)}:${resultado.direccion.toLocaleLowerCase('es-BO')}`;
    if (!mapa.has(clave)) mapa.set(clave, resultado);
  }

  return [...mapa.values()]
    .sort((a, b) => {
      const porTipo = prioridadTipo(a.tipo) - prioridadTipo(b.tipo);
      if (porTipo !== 0) return porTipo;
      return a.direccion.localeCompare(b.direccion, 'es-BO');
    })
    .slice(0, 8);
}

@Injectable()
export class GeografiaService {
  constructor(private readonly db: DataSource) {}

  private claveGeoapify(): string {
    const apiKey = process.env.GEOAPIFY_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'El proveedor externo de geocodificacion no esta configurado.',
      );
    }
    return apiKey;
  }

  private async consultarGeoapify(
    ruta: 'search' | 'reverse' | 'autocomplete',
    parametros: Record<string, string>,
  ): Promise<GeoapifyRespuesta> {
    const url = new URL(`https://api.geoapify.com/v1/geocode/${ruta}`);
    for (const [clave, valor] of Object.entries(parametros)) {
      url.searchParams.set(clave, valor);
    }
    url.searchParams.set('format', 'json');
    url.searchParams.set('lang', 'es');
    url.searchParams.set('apiKey', this.claveGeoapify());

    let respuesta: Response;
    try {
      respuesta = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(6000),
      });
    } catch {
      throw new ServiceUnavailableException(
        'El proveedor externo de geocodificacion no esta disponible.',
      );
    }

    if (!respuesta.ok) {
      throw new ServiceUnavailableException(
        'El proveedor externo de geocodificacion respondio con error.',
      );
    }

    try {
      return (await respuesta.json()) as GeoapifyRespuesta;
    } catch {
      throw new ServiceUnavailableException(
        'El proveedor externo de geocodificacion devolvio una respuesta invalida.',
      );
    }
  }

  private async consultarPhoton(consulta: string) {
    const url = new URL('https://photon.komoot.io/api/');
    url.searchParams.set('q', consulta);
    url.searchParams.set('lang', 'es');
    url.searchParams.set('limit', '12');
    url.searchParams.set('lat', '-21.535486');
    url.searchParams.set('lon', '-64.729557');

    try {
      const respuesta = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'ZAV-Sistema/2026' },
        signal: AbortSignal.timeout(6000),
      });
      if (!respuesta.ok) return [];
      const cuerpo = (await respuesta.json()) as {
        features?: Array<{
          geometry?: { coordinates?: unknown[] };
          properties?: Record<string, unknown>;
        }>;
      };

      return (cuerpo.features ?? [])
        .map((feature) => {
          const p = feature.properties ?? {};
          const coordenadas = feature.geometry?.coordinates ?? [];
          const longitud = Number(coordenadas[0]);
          const latitud = Number(coordenadas[1]);
          const estado = textoOpcional(p.state);
          const ciudad = textoOpcional(p.city);
          const county = textoOpcional(p.county);
          const distrito = textoOpcional(p.district);
          const paisCodigo = textoOpcional(p.countrycode).toLowerCase();
          const contexto = [estado, ciudad, county, distrito]
            .join(' ')
            .toLocaleLowerCase('es-BO');

          if (
            paisCodigo !== 'bo' ||
            !contexto.includes('tarija') ||
            !Number.isFinite(latitud) ||
            !Number.isFinite(longitud)
          ) {
            return null;
          }

          const principal =
            textoOpcional(p.name) ||
            textoOpcional(p.street) ||
            textoOpcional(p.locality) ||
            ciudad ||
            distrito;
          const secundaria = [
            textoOpcional(p.street),
            distrito,
            ciudad,
            county,
            estado,
          ]
            .filter(Boolean)
            .filter((valor, indice, todos) => todos.indexOf(valor) === indice)
            .join(', ');

          if (!principal) return null;
          return {
            direccion: [principal, secundaria].filter(Boolean).join(', '),
            principal,
            secundaria,
            tipo: textoOpcional(p.type) || 'place',
            departamento: estado || null,
            ciudad: ciudad || null,
            paisCodigo,
            latitud,
            longitud,
          };
        })
        .filter((resultado): resultado is NonNullable<typeof resultado> => resultado !== null)
        .slice(0, 8);
    } catch {
      return [];
    }
  }

  private async buscarEnTarija(
    ruta: 'search' | 'autocomplete',
    consulta: string,
  ) {
    const buscarPhoton = () =>
      this.consultarPhoton(`${consulta}, Tarija, Bolivia`);

    if (!process.env.GEOAPIFY_API_KEY?.trim()) {
      const alternativos = await buscarPhoton();
      if (alternativos.length) return alternativos;
      throw new ServiceUnavailableException(
        'El servicio de búsqueda de direcciones no está disponible.',
      );
    }

    const comunes = { filter: 'countrycode:bo', limit: '8' };

    try {
      const [tarija, bolivia] = await Promise.all([
        this.consultarGeoapify(ruta, {
          ...comunes,
          text: `${consulta}, Tarija, Bolivia`,
        }),
        this.consultarGeoapify(ruta, {
          ...comunes,
          text: consulta,
        }),
      ]);
      const resultados = combinarResultados(
        tarija.results ?? [],
        bolivia.results ?? [],
      );
      if (resultados.length) return resultados;
    } catch {
      const alternativos = await buscarPhoton();
      if (alternativos.length) return alternativos;
      throw new ServiceUnavailableException(
        'No se pudieron consultar direcciones en Tarija.',
      );
    }

    return buscarPhoton();
  }

  async geocodificar(entrada: unknown) {
    const consulta = consultaDireccion(entrada);
    const resultados = await this.buscarEnTarija('search', consulta);
    return {
      proveedor: 'GEOAPIFY',
      alcance: 'TARIJA_BOLIVIA',
      resultados,
    };
  }

  async autocompletar(entrada: unknown) {
    const consulta = consultaDireccion(entrada);
    const resultados = await this.buscarEnTarija('autocomplete', consulta);
    return {
      proveedor: 'GEOAPIFY',
      alcance: 'TARIJA_BOLIVIA',
      resultados,
    };
  }

  async geocodificacionInversa(latitudEntrada: unknown, longitudEntrada: unknown) {
    const latitud = coordenadaConsulta(latitudEntrada, 'latitud', -90, 90);
    const longitud = coordenadaConsulta(longitudEntrada, 'longitud', -180, 180);
    const cuerpo = await this.consultarGeoapify('reverse', {
      lat: String(latitud),
      lon: String(longitud),
      limit: '1',
    });
    const normalizado = cuerpo.results?.map(normalizarResultado).find(Boolean) ?? null;

    if (!normalizado || !esTarija(normalizado)) {
      throw new BadRequestException(
        'El punto seleccionado debe estar dentro del departamento de Tarija, Bolivia.',
      );
    }

    return {
      proveedor: 'GEOAPIFY',
      alcance: 'TARIJA_BOLIVIA',
      direccion: normalizado.direccion,
      paisCodigo: normalizado.paisCodigo,
      departamento: normalizado.departamento,
    };
  }

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

export { combinarResultados, direccionHumana, distanciaHaversine };
