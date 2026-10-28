import { bloquearProductos } from './bloqueos.js';
import { conflictoCatalogo } from '../catalogo/validacion-catalogo.js';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type EntityManager } from 'typeorm';
import { ProductoEntity } from '../database/entities/producto.entity.js';
import {
  activoFiltro,
  codigo,
  codigoPostgres,
  consultaTexto,
  enteroPositivo,
  objeto,
  paginacion,
  precio,
  texto,
  uuid,
} from './validacion.js';

const CAMPOS_PRODUCTO = [
  'codigo',
  'nombre',
  'familia',
  'presentacion',
  'pesoGramos',
  'precioBob',
  'validacionComercial',
];

@Injectable()
export class ProductosService {
  constructor(
    @InjectRepository(ProductoEntity)
    private readonly productos: Repository<ProductoEntity>,
  ) {}

  async crear(entrada: unknown, actor: string) {
    const datos = objeto(entrada, CAMPOS_PRODUCTO);
    const nuevo = this.productos.create({
      codigo: codigo(datos.codigo, 'codigo', 40),
      nombre: texto(datos.nombre, 'nombre', 120),
      familia: texto(datos.familia, 'familia', 70),
      presentacion: texto(datos.presentacion, 'presentacion', 100),
      pesoGramos: enteroPositivo(datos.pesoGramos, 'pesoGramos'),
      precioBob: precio(datos.precioBob),
      activo: true,
    });
    try {
      return await this.productos.manager.transaction(async (manager) => {
        await manager.query(
          "SELECT pg_advisory_xact_lock(hashtext('catalogo:jerarquia'))",
        );
        const resultado = await manager
          .getRepository(ProductoEntity)
          .save(nuevo);
        await this.validarComercial(
          manager,
          resultado.id,
          datos.validacionComercial,
          actor,
        );
        await this.auditar(manager, resultado.id, actor, null);
        return resultado;
      });
    } catch (error) {
      if (codigoPostgres(error) === '23505')
        throw new ConflictException('El codigo del producto ya existe.');
      throw error;
    }
  }

  async listar(consulta: Record<string, unknown>) {
    const { page, limit } = paginacion(consulta, [
      'page',
      'limit',
      'q',
      'activo',
    ]);
    const q = consultaTexto(consulta.q, 'q', 100);
    const activo = activoFiltro(consulta.activo);
    const qb = this.productos.createQueryBuilder('p');
    if (q)
      qb.andWhere('(p.nombre ILIKE :q OR p.codigo ILIKE :q)', { q: `%${q}%` });
    if (activo !== undefined) qb.andWhere('p.activo = :activo', { activo });
    const [items, total] = await qb
      .orderBy('p.creado_en', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { items, total, page, limit };
  }

  async obtener(id: string) {
    const valido = uuid(id, 'id');
    const producto = await this.productos.findOneBy({ id: valido });
    if (!producto) throw new NotFoundException('Producto no encontrado.');
    return producto;
  }

  async editar(id: string, entrada: unknown, actor: string) {
    const valido = uuid(id, 'id');
    const datos = objeto(entrada, CAMPOS_PRODUCTO);
    if (Object.keys(datos).length === 0) {
      throw new BadRequestException(
        'Debe enviar al menos un campo para editar el producto.',
      );
    }

    return this.productos.manager.transaction(async (manager) => {
      await manager.query(
        "SELECT pg_advisory_xact_lock(hashtext('catalogo:jerarquia'))",
      );
      await bloquearProductos(manager, [valido]);
      const repo = manager.getRepository(ProductoEntity);
      const producto = await repo.findOneBy({ id: valido });
      if (!producto) throw new NotFoundException('Producto no encontrado.');

      const anterior = await manager.query(
        'SELECT to_jsonb(p) AS datos FROM producto p WHERE id=$1',
        [valido],
      );
      if (datos.codigo !== undefined)
        producto.codigo = codigo(datos.codigo, 'codigo', 40);
      if (datos.nombre !== undefined)
        producto.nombre = texto(datos.nombre, 'nombre', 120);
      if (datos.familia !== undefined)
        producto.familia = texto(datos.familia, 'familia', 70);
      if (datos.presentacion !== undefined)
        producto.presentacion = texto(datos.presentacion, 'presentacion', 100);
      if (datos.pesoGramos !== undefined)
        producto.pesoGramos = enteroPositivo(datos.pesoGramos, 'pesoGramos');
      if (datos.precioBob !== undefined)
        producto.precioBob = precio(datos.precioBob);

      try {
        const resultado = await repo.save(producto);
        await this.validarComercial(
          manager,
          valido,
          datos.validacionComercial,
          actor,
        );
        await this.auditar(manager, valido, actor, anterior[0].datos);
        return resultado;
      } catch (error) {
        if (codigoPostgres(error) === '23505') {
          throw new ConflictException('El codigo del producto ya existe.');
        }
        conflictoCatalogo(error);
      }
    });
  }

  async darBaja(id: string, actor: string) {
    const valido = uuid(id, 'id');
    return this.productos.manager.transaction(async (manager) => {
      await bloquearProductos(manager, [valido]);
      const repo = manager.getRepository(ProductoEntity);
      const anterior = await manager.query(
        'SELECT to_jsonb(p) AS datos FROM producto p WHERE id=$1',
        [valido],
      );
      const producto = await repo.findOneBy({ id: valido });
      if (!producto) throw new NotFoundException('Producto no encontrado.');

      if (producto.activo) {
        producto.activo = false;
        await repo.save(producto);
      }
      await this.auditar(manager, valido, actor, anterior[0].datos);
      return producto;
    });
  }
  private async validarComercial(
    m: EntityManager,
    id: string,
    valor: unknown,
    actor: string,
  ) {
    if (valor === undefined) return;
    if (valor !== 'PROVISIONAL' && valor !== 'VALIDADO')
      throw new BadRequestException('Validación comercial inválida.');
    await m.query(
      `UPDATE producto SET validacion_comercial=$2::text,validado_por=CASE WHEN $2::text='VALIDADO' THEN $3::uuid ELSE NULL END,validado_en=CASE WHEN $2::text='VALIDADO' THEN now() ELSE NULL END WHERE id=$1`,
      [id, valor, actor],
    );
  }
  private async auditar(
    m: EntityManager,
    id: string,
    actor: string,
    anterior: unknown,
  ) {
    await m.query(
      `INSERT INTO catalogo_auditoria(entidad,entidad_id,usuario_id,anterior,posterior) SELECT 'producto',$1,$2,$3,to_jsonb(p) FROM producto p WHERE id=$1`,
      [id, actor, JSON.stringify(anterior)],
    );
  }
}
