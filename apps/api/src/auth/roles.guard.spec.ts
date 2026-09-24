import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(['ADMINISTRADOR']),
  } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  function contexto(rol: 'ADMINISTRADOR' | 'VENDEDOR'): ExecutionContext {
    return {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ usuario: { rol } }) }),
    } as unknown as ExecutionContext;
  }

  it('autoriza al administrador en una ruta administrativa', () => {
    expect(guard.canActivate(contexto('ADMINISTRADOR'))).toBe(true);
  });

  it('rechaza al vendedor en una ruta administrativa', () => {
    expect(() => guard.canActivate(contexto('VENDEDOR'))).toThrow(ForbiddenException);
  });
});
