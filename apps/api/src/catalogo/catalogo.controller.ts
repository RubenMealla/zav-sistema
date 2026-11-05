import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  JwtAuthGuard,
  type SolicitudAutenticada,
} from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CatalogoService } from './catalogo.service.js';
import {
  ImagenesService,
  LIMITE_IMAGEN,
  type ArchivoImagen,
} from './imagenes.service.js';

@Controller('api/v1/catalogo')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMINISTRADOR')
export class CatalogoController {
  constructor(
    private readonly catalogo: CatalogoService,
    private readonly imagenes: ImagenesService,
  ) {}
  @Get('familias') familias(@Query() q: Record<string, unknown>) {
    return this.catalogo.listar('familias', q);
  }
  @Get('familias/:id') familia(@Param('id') id: string) {
    return this.catalogo.obtener('familias', id);
  }
  @Post('familias') crearFamilia(
    @Body() datos: unknown,
    @Req() r: SolicitudAutenticada,
  ) {
    return this.catalogo.guardar('familias', null, datos, r.usuario!.id);
  }
  @Patch('familias/:id') editarFamilia(
    @Param('id') id: string,
    @Body() datos: unknown,
    @Req() r: SolicitudAutenticada,
  ) {
    return this.catalogo.guardar('familias', id, datos, r.usuario!.id);
  }
  @Get('productos') productos(@Query() q: Record<string, unknown>) {
    return this.catalogo.listar('productos', q);
  }
  @Get('productos/:id') producto(@Param('id') id: string) {
    return this.catalogo.obtener('productos', id);
  }
  @Post('productos') crearProducto(
    @Body() datos: unknown,
    @Req() r: SolicitudAutenticada,
  ) {
    return this.catalogo.guardar('productos', null, datos, r.usuario!.id);
  }
  @Patch('productos/:id') editarProducto(
    @Param('id') id: string,
    @Body() datos: unknown,
    @Req() r: SolicitudAutenticada,
  ) {
    return this.catalogo.guardar('productos', id, datos, r.usuario!.id);
  }
  @Get('presentaciones') presentaciones(@Query() q: Record<string, unknown>) {
    return this.catalogo.listarPresentaciones(q);
  }
  @Get('presentaciones/:id') presentacion(@Param('id') id: string) {
    return this.catalogo.obtenerPresentacion(id);
  }
  @Post('presentaciones') crearPresentacion(
    @Body() datos: unknown,
    @Req() r: SolicitudAutenticada,
  ) {
    return this.catalogo.guardarPresentacion(null, datos, r.usuario!.id);
  }
  @Patch('presentaciones/:id') editarPresentacion(
    @Param('id') id: string,
    @Body() datos: unknown,
    @Req() r: SolicitudAutenticada,
  ) {
    return this.catalogo.guardarPresentacion(id, datos, r.usuario!.id);
  }
  @Post('imagenes')
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: LIMITE_IMAGEN, files: 1, fields: 0, parts: 1 },
    }),
  )
  subir(
    @UploadedFile() archivo: ArchivoImagen | undefined,
    @Req() r: SolicitudAutenticada,
  ) {
    return this.imagenes.guardar(archivo, r.usuario!.id);
  }
  @Get('imagenes/:id')
  async imagen(@Param('id') id: string, @Res() res: Response) {
    const i = await this.imagenes.obtener(id, false);
    res
      .set({
        'Content-Type': i.tipo,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      })
      .send(i.contenido);
  }
}

@Controller('api/v1/publico/catalogo')
export class CatalogoPublicoController {
  constructor(
    private readonly catalogo: CatalogoService,
    private readonly imagenes: ImagenesService,
  ) {}
  @Get()
  async publico(@Res({ passthrough: true }) res: Response) {
    res.set('Cache-Control', 'no-store');
    return this.catalogo.publico();
  }
  @Get('imagenes/:id')
  async imagen(@Param('id') id: string, @Res() res: Response) {
    const i = await this.imagenes.obtener(id, true);
    res
      .set({
        'Content-Type': i.tipo,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      })
      .send(i.contenido);
  }
}
