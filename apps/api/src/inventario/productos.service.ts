import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

const CAMPOS_PRODUCTO = ['codigo', 'nombre', 'familia', 'presentacion', 'pesoGramos', 'precioBob'];

@Injectable()
export class ProductosService {
  constructor(@InjectRepository(ProductoEntity) private readonly productos: Repository<ProductoEntity>) {}

  async crear(entrada: unknown) {
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
      const resultado = await this.productos.save(nuevo);
      return resultado;
    } catch (error) {
      if (codigoPostgres(error) === '23505') throw new ConflictException('El codigo del producto ya existe.');
      throw error;
    }
  }

  async listar(consulta: Record<string, unknown>) {
    const { page, limit } = paginacion(consulta, ['page', 'limit', 'q', 'activo']);
    const q = consultaTexto(consulta.q, 'q', 100);
    const activo = activoFiltro(consulta.activo);
    const qb = this.productos.createQueryBuilder('p');
    if (q) qb.andWhere('(p.nombre ILIKE :q OR p.codigo ILIKE :q)', { q: `%${q}%` });
    if (activo !== undefined) qb.andWhere('p.activo = :activo', { activo });
    const [items, total] = await qb.orderBy('p.creado_en', 'DESC').addOrderBy('p.id', 'DESC')
      .skip((page - 1) * limit).take(limit).getManyAndCount();
    return { items, total, page, limit };
  }

  async obtener(id: string) {
    const valido = uuid(id, 'id');
    const producto = await this.productos.findOneBy({ id: valido });
    if (!producto) throw new NotFoundException('Producto no encontrado.');
    return producto;
  }
}
