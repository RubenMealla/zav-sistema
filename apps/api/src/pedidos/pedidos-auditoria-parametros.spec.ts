import { describe, expect, it, vi } from 'vitest';
import { DataSource } from 'typeorm';
import { PedidosService } from './pedidos.service.js';

describe('PedidosService.listarAdmin: marcadores SQL', () => {
  it('parametriza vendedor, búsqueda y fechas sin concatenar los valores en SQL', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);
    const service = new PedidosService({ query } as unknown as DataSource);
    const vendedorId = '3c96bfdd-1e2e-4a6c-bc38-1777da041944';

    const resultado = await service.listarAdmin({
      estado: 'REGISTRADO',
      vendedorId,
      q: 'clienteQA',
      desde: '2026-10-01',
      hasta: '2026-10-10',
      page: '1',
      limit: '20',
    });

    expect(resultado.total).toBe(0);
    expect(query).toHaveBeenCalledTimes(2);
    const [sqlItems, argsItems] = query.mock.calls[0] as [string, unknown[]];
    const [sqlTotal, argsTotal] = query.mock.calls[1] as [string, unknown[]];

    for (const sql of [sqlItems, sqlTotal]) {
      expect(sql).toContain('pe.estado = $1');
      expect(sql).toContain('pe.vendedor_id = $2::uuid');
      expect(sql).toContain('c.nombre ILIKE $3');
      expect(sql).toContain('pe.creado_en >= $4::date');
      expect(sql).toContain("pe.creado_en < ($5::date + interval '1 day')");
      expect(sql).not.toContain('clienteQA');
    }
    expect(sqlItems).toContain('LIMIT $6 OFFSET $7');
    expect(argsItems).toEqual([
      'REGISTRADO', vendedorId, '%clienteQA%', '2026-10-01',
      '2026-10-10', 20, 0,
    ]);
    expect(argsTotal).toEqual(argsItems.slice(0, 5));
  });
});
