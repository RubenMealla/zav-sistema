import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { Repository } from 'typeorm';
import { UsuarioEntity } from '../database/entities/usuario.entity.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  const findOne = vi.fn();
  const signAsync = vi.fn();
  const servicio = new AuthService(
    { findOne } as unknown as Repository<UsuarioEntity>,
    { signAsync } as unknown as JwtService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rechaza entradas invalidas sin buscar usuarios', async () => {
    await expect(servicio.iniciarSesion({ identificador: 123, contrasena: '' })).rejects.toBeInstanceOf(BadRequestException);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('rechaza un identificador inexistente sin emitir token', async () => {
    findOne.mockResolvedValue(null);
    await expect(servicio.iniciarSesion({ identificador: 'desconocido', contrasena: 'clave-de-prueba' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(signAsync).not.toHaveBeenCalled();
  });

  it('rechaza una cuenta inactiva', async () => {
    findOne.mockResolvedValue({ activo: false });
    await expect(servicio.iniciarSesion({ identificador: 'usuario', contrasena: 'clave-de-prueba' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(signAsync).not.toHaveBeenCalled();
  });

  it('verifica el hash y devuelve un token sin exponer la contrasena', async () => {
    const contrasenaHash = await argon2.hash('clave-de-prueba');
    findOne.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      identificador: 'admin.zav',
      nombre: 'Administrador',
      contrasenaHash,
      activo: true,
      rol: 'ADMINISTRADOR',
    });
    signAsync.mockResolvedValue('token-de-prueba');

    const respuesta = await servicio.iniciarSesion({ identificador: 'ADMIN.ZAV', contrasena: 'clave-de-prueba' });
    expect(respuesta.usuario.rol).toBe('ADMINISTRADOR');
    expect(respuesta.accessToken).toBe('token-de-prueba');
    expect(JSON.stringify(respuesta)).not.toContain(contrasenaHash);
    expect(signAsync).toHaveBeenCalledWith({ sub: '11111111-1111-4111-8111-111111111111' });
  });
});
