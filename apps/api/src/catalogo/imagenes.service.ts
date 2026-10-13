import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { DataSource } from 'typeorm';
import { uuid } from '../inventario/validacion.js';

export interface ArchivoImagen {
  buffer: Buffer;
  mimetype: string;
  size: number;
}
export const LIMITE_IMAGEN = 5 * 1024 * 1024;

@Injectable()
export class ImagenesService {
  constructor(private readonly db: DataSource) {}

  async guardar(archivo: ArchivoImagen | undefined, actor: string) {
    if (!archivo?.buffer?.length)
      throw new BadRequestException('Selecciona una imagen.');
    if (archivo.size > LIMITE_IMAGEN || archivo.buffer.length > LIMITE_IMAGEN)
      throw new PayloadTooLargeException('La imagen supera 5 MB.');
    const formatos: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpeg',
      'image/webp': 'webp',
    };
    if (!formatos[archivo.mimetype])
      throw new UnsupportedMediaTypeException(
        'Solo se admiten PNG, JPEG y WebP.',
      );
    let salida: { data: Buffer; info: { width: number; height: number } };
    try {
      const decodificador = sharp(archivo.buffer, {
        failOn: 'warning',
        limitInputPixels: 4096 * 4096,
      });
      const meta = await decodificador.metadata();
      if (
        meta.format !== formatos[archivo.mimetype] ||
        !meta.width ||
        !meta.height ||
        meta.width > 4096 ||
        meta.height > 4096 ||
        (meta.pages ?? 1) !== 1
      ) {
        throw new Error('Contenido no admitido');
      }
      // Decodificación completa y eliminación de metadatos privados/cargas anexas.
      // Los originales incluidos en Git no pasan por esta transformación.
      salida = await decodificador
        .rotate()
        .png()
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new BadRequestException(
        'Contenido de imagen inválido; máximo 4096 × 4096, sin animación.',
      );
    }
    if (salida.data.length > LIMITE_IMAGEN)
      throw new PayloadTooLargeException(
        'La imagen procesada supera 5 MB. Reduce sus dimensiones.',
      );
    const sha = createHash('sha256').update(salida.data).digest('hex');
    const [fila] = (await this.db.query(
      `INSERT INTO imagen_catalogo(contenido,tipo,sha256,ancho,alto,usuario_id)
      VALUES ($1,'image/png',$2,$3,$4,$5) ON CONFLICT(sha256) DO UPDATE SET sha256=EXCLUDED.sha256
      RETURNING id,ancho,alto`,
      [salida.data, sha, salida.info.width, salida.info.height, actor],
    )) as { id: string; ancho: number; alto: number }[];
    return { ...fila, url: `/api/v1/catalogo/imagenes/${fila.id}` };
  }

  async obtener(idEntrada: string, publica: boolean) {
    const condicion = publica
      ? `AND (EXISTS(SELECT 1 FROM familia f WHERE f.imagen_id=i.id AND f.activo AND f.publicado)
      OR EXISTS(SELECT 1 FROM producto_comercial c JOIN familia f ON f.id=c.familia_id
        WHERE c.imagen_id=i.id AND c.activo AND c.publicado AND f.activo AND f.publicado))`
      : '';
    const [imagen] = (await this.db.query(
      `SELECT contenido,tipo,sha256 FROM imagen_catalogo i WHERE id=$1 ${condicion}`,
      [uuid(idEntrada, 'id')],
    )) as { contenido: Buffer; tipo: string; sha256: string }[];
    if (!imagen) throw new NotFoundException('Imagen no encontrada.');
    return imagen;
  }
}
