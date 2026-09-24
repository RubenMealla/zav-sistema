import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { Repository } from 'typeorm';
import { UsuarioEntity } from '../database/entities/usuario.entity.js';

const IDENTIFICADOR_VALIDO = /^[a-z0-9._@-]{3,120}$/;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UsuarioEntity)
    private readonly usuarios: Repository<UsuarioEntity>,
    private readonly jwt: JwtService,
  ) {}

  async iniciarSesion(entrada: unknown) {
    if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) {
      throw new BadRequestException('Debes indicar identificador y contrasena.');
    }

    const datos = entrada as Record<string, unknown>;
    if (typeof datos.identificador !== 'string' || typeof datos.contrasena !== 'string') {
      throw new BadRequestException('Debes indicar identificador y contrasena.');
    }

    const identificador = datos.identificador.trim().toLowerCase();
    const contrasena = datos.contrasena;
    if (!IDENTIFICADOR_VALIDO.test(identificador) || contrasena.length < 1 || contrasena.length > 128) {
      throw new BadRequestException('Identificador o contrasena con formato invalido.');
    }

    // El hash esta excluido de las consultas generales: solicitarlo solo aqui.
    const usuario = await this.usuarios.findOne({
      where: { identificador },
      select: {
        id: true,
        nombre: true,
        identificador: true,
        contrasenaHash: true,
        rol: true,
        activo: true,
      },
    });

    if (!usuario?.activo || !usuario.contrasenaHash || !(await argon2.verify(usuario.contrasenaHash, contrasena))) {
      throw new UnauthorizedException('Credenciales incorrectas.');
    }

    // El rol no viaja en el JWT: cada peticion obtiene los permisos vigentes en BD.
    const accessToken = await this.jwt.signAsync({ sub: usuario.id });
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 900,
      usuario: {
        id: usuario.id,
        identificador: usuario.identificador,
        nombre: usuario.nombre,
        rol: usuario.rol,
      },
    };
  }
}
