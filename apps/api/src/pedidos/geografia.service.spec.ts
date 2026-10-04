import { describe, expect, it } from 'vitest';
import {
  combinarResultados,
  direccionHumana,
} from './geografia.service.js';

describe('geografia: normalizacion de resultados', () => {
  it('elimina plus codes de la direccion visible cuando existen datos legibles', () => {
    const direccion = direccionHumana({
      address_line1: 'F67P+GQ3',
      street: 'Calle La Cruz',
      suburb: 'Senac',
      city: 'Tarija',
      state: 'Departamento de Tarija',
      country_code: 'bo',
      lat: -21.535,
      lon: -64.763,
    });

    expect(direccion).toBe(
      'Calle La Cruz, Senac, Tarija, Departamento de Tarija',
    );
    expect(direccion).not.toContain('+');
  });

  it('descarta resultados fuera de Bolivia y prioriza coincidencias de Tarija', () => {
    const resultados = combinarResultados(
      [
        {
          address_line1: 'Barrio Senac',
          city: 'Tarija',
          state: 'Departamento de Tarija',
          country_code: 'bo',
          result_type: 'suburb',
          lat: -21.535,
          lon: -64.763,
        },
      ],
      [
        {
          address_line1: 'Senac',
          city: 'Cochabamba',
          state: 'Cochabamba',
          country_code: 'bo',
          result_type: 'suburb',
          lat: -17.39,
          lon: -66.15,
        },
        {
          address_line1: 'Sénac',
          city: 'Annecy',
          state: 'Auvergne-Rhône-Alpes',
          country_code: 'fr',
          result_type: 'street',
          lat: 45.9,
          lon: 6.1,
        },
      ],
    );

    expect(resultados).toHaveLength(2);
    expect(resultados[0]).toEqual(
      expect.objectContaining({
        principal: 'Barrio Senac',
        ciudad: 'Tarija',
        paisCodigo: 'bo',
      }),
    );
    expect(resultados.every((resultado) => resultado.paisCodigo === 'bo')).toBe(
      true,
    );
  });
});
